package middleware

import "net/http"

func Chain(handler http.Handler, middlewares ...func(http.Handler) http.Handler) http.Handler {
	current := handler
	for index := len(middlewares) - 1; index >= 0; index-- {
		current = middlewares[index](current)
	}
	return current
}
