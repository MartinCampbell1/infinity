package auth

import (
	"encoding/json"
	"net"
	"net/http"
	"strings"
)

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

func LocalhostOnly(next http.Handler) http.Handler {
	return http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		if requestIsLoopback(request) {
			next.ServeHTTP(response, request)
			return
		}

		response.Header().Set("content-type", "application/json")
		response.WriteHeader(http.StatusForbidden)
		_ = json.NewEncoder(response).Encode(map[string]string{
			"detail": "execution-kernel only accepts localhost requests",
		})
	})
}

func Noop(next http.Handler) http.Handler {
	return LocalhostOnly(next)
}
