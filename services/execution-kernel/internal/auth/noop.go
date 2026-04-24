package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"strings"
	"time"
)

const (
	ScopeKernelBatchCreate   = "kernel.batch.create"
	ScopeKernelAttemptMutate = "kernel.attempt.mutate"
	ScopeKernelHealthRead    = "kernel.health.read"

	defaultAudience = "execution-kernel"
	defaultIssuer   = "founderos-shell"
)

type Config struct {
	Secret                  string
	PreviousSecret          string
	DeploymentEnv           string
	AllowLocalhostDevBypass bool
	Clock                   func() time.Time
}

type tokenClaims struct {
	Issuer    string   `json:"iss"`
	Audience  string   `json:"aud"`
	Scopes    []string `json:"scp"`
	IssuedAt  int64    `json:"iat"`
	ExpiresAt int64    `json:"exp"`
}

func isLoopbackHost(value string) bool {
	trimmed := strings.Trim(strings.TrimSpace(value), "[]")
	if trimmed == "" {
		return false
	}
	if strings.EqualFold(trimmed, "localhost") {
		return true
	}
	ip := net.ParseIP(trimmed)
	return ip != nil && ip.IsLoopback()
}

func requestIsLoopback(request *http.Request) bool {
	host := request.RemoteAddr
	if parsedHost, _, err := net.SplitHostPort(request.RemoteAddr); err == nil {
		host = parsedHost
	}

	return isLoopbackHost(host)
}

func normalizeEnv(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func isProductionLike(value string) bool {
	normalized := normalizeEnv(value)
	return normalized == "production" || normalized == "staging"
}

func (config Config) now() time.Time {
	if config.Clock != nil {
		return config.Clock().UTC()
	}
	return time.Now().UTC()
}

func (config Config) secrets() []string {
	secrets := make([]string, 0, 2)
	if strings.TrimSpace(config.Secret) != "" {
		secrets = append(secrets, strings.TrimSpace(config.Secret))
	}
	if strings.TrimSpace(config.PreviousSecret) != "" {
		secrets = append(secrets, strings.TrimSpace(config.PreviousSecret))
	}
	return secrets
}

func requiredScopeForRequest(request *http.Request) string {
	path := request.URL.Path
	if request.Method == http.MethodGet && path == "/healthz" {
		return ScopeKernelHealthRead
	}
	if request.Method == http.MethodPost && path == "/api/v1/batches" {
		return ScopeKernelBatchCreate
	}
	if request.Method == http.MethodPost &&
		strings.HasPrefix(path, "/api/v1/batches/") &&
		(strings.HasSuffix(path, "/resume") ||
			strings.HasSuffix(path, "/discard") ||
			strings.HasSuffix(path, "/retry-work-unit") ||
			strings.HasSuffix(path, "/lease-next")) {
		return ScopeKernelAttemptMutate
	}
	if request.Method == http.MethodPost &&
		strings.HasPrefix(path, "/api/v1/attempts/") &&
		(strings.HasSuffix(path, "/complete") ||
			strings.HasSuffix(path, "/fail") ||
			strings.HasSuffix(path, "/heartbeat")) {
		return ScopeKernelAttemptMutate
	}
	return ScopeKernelHealthRead
}

func tokenFromRequest(request *http.Request) string {
	if bearer := strings.TrimSpace(request.Header.Get("Authorization")); bearer != "" {
		prefix := "Bearer "
		if len(bearer) > len(prefix) && strings.EqualFold(bearer[:len(prefix)], prefix) {
			return strings.TrimSpace(bearer[len(prefix):])
		}
		return ""
	}
	return strings.TrimSpace(request.Header.Get("X-Execution-Kernel-Token"))
}

func writeAuthError(response http.ResponseWriter, status int, detail string) {
	response.Header().Set("content-type", "application/json")
	response.WriteHeader(status)
	_ = json.NewEncoder(response).Encode(map[string]string{"detail": detail})
}

func ServiceToService(config Config) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
			secrets := config.secrets()
			if len(secrets) == 0 {
				if !isProductionLike(config.DeploymentEnv) &&
					config.AllowLocalhostDevBypass &&
					requestIsLoopback(request) {
					next.ServeHTTP(response, request)
					return
				}
				writeAuthError(response, http.StatusUnauthorized, "execution-kernel service auth token is required")
				return
			}

			claims, err := verifyServiceToken(tokenFromRequest(request), secrets, config.now())
			if err != nil {
				writeAuthError(response, http.StatusUnauthorized, "invalid execution-kernel service auth token")
				return
			}
			scope := requiredScopeForRequest(request)
			if !claims.hasScope(scope) {
				writeAuthError(response, http.StatusForbidden, fmt.Sprintf("execution-kernel service token missing scope %s", scope))
				return
			}

			next.ServeHTTP(response, request)
		})
	}
}

func LocalhostOnly(next http.Handler) http.Handler {
	return ServiceToService(Config{
		AllowLocalhostDevBypass: true,
	})(next)
}

func Noop(next http.Handler) http.Handler {
	return LocalhostOnly(next)
}

func SignServiceToken(secret string, scopes []string, now time.Time, ttl time.Duration) (string, error) {
	if strings.TrimSpace(secret) == "" {
		return "", fmt.Errorf("service token secret is required")
	}
	if ttl <= 0 {
		return "", fmt.Errorf("service token ttl must be positive")
	}
	header := map[string]string{
		"alg": "HS256",
		"typ": "JWT",
	}
	claims := tokenClaims{
		Issuer:    defaultIssuer,
		Audience:  defaultAudience,
		Scopes:    scopes,
		IssuedAt:  now.UTC().Unix(),
		ExpiresAt: now.UTC().Add(ttl).Unix(),
	}
	headerRaw, err := json.Marshal(header)
	if err != nil {
		return "", err
	}
	claimsRaw, err := json.Marshal(claims)
	if err != nil {
		return "", err
	}
	unsigned := fmt.Sprintf("%s.%s", base64URL(headerRaw), base64URL(claimsRaw))
	signature := sign(secret, unsigned)
	return fmt.Sprintf("%s.%s", unsigned, base64URL(signature)), nil
}

func verifyServiceToken(token string, secrets []string, now time.Time) (tokenClaims, error) {
	var claims tokenClaims
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return claims, fmt.Errorf("invalid token shape")
	}
	unsigned := fmt.Sprintf("%s.%s", parts[0], parts[1])
	signature, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return claims, err
	}
	validSignature := false
	for _, secret := range secrets {
		expected := sign(secret, unsigned)
		if subtle.ConstantTimeCompare(signature, expected) == 1 {
			validSignature = true
			break
		}
	}
	if !validSignature {
		return claims, fmt.Errorf("invalid signature")
	}
	claimsRaw, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return claims, err
	}
	if err := json.Unmarshal(claimsRaw, &claims); err != nil {
		return claims, err
	}
	if claims.Audience != defaultAudience {
		return claims, fmt.Errorf("invalid audience")
	}
	if claims.ExpiresAt <= now.UTC().Unix() {
		return claims, fmt.Errorf("expired token")
	}
	return claims, nil
}

func (claims tokenClaims) hasScope(scope string) bool {
	for _, candidate := range claims.Scopes {
		if candidate == scope {
			return true
		}
	}
	return false
}

func sign(secret string, value string) []byte {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(value))
	return mac.Sum(nil)
}

func base64URL(value []byte) string {
	return base64.RawURLEncoding.EncodeToString(value)
}
