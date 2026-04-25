const LOCAL_USER_PATH_PATTERN = /\/Users\/[^/\s"'<>]+(?:\/[^\s"'<>]*)?/g;

export function redactLocalUiText(value: string) {
  return value.replace(LOCAL_USER_PATH_PATTERN, "[local workspace path]");
}
