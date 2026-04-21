package auth

import "net/http"

func Noop(next http.Handler) http.Handler {
	return next
}
