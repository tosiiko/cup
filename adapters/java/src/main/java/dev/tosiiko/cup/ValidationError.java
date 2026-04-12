package dev.tosiiko.cup;

import java.util.List;

public final class ValidationError extends RuntimeException {
    private final List<String> issues;

    public ValidationError(List<String> issues) {
        super("invalid CUP protocol view: " + String.join("; ", issues));
        this.issues = issues;
    }

    public List<String> issues() {
        return issues;
    }
}
