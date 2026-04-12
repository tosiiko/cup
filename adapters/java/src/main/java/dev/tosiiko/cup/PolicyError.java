package dev.tosiiko.cup;

import java.util.List;

public final class PolicyError extends RuntimeException {
    private final List<String> issues;

    public PolicyError(List<String> issues) {
        super("CUP view policy rejected: " + String.join("; ", issues));
        this.issues = issues;
    }

    public List<String> issues() {
        return issues;
    }
}
