package dev.tosiiko.cup;

public final class ViewPolicy {
    public boolean requireVersion;
    public boolean requireTitle;
    public boolean requireRoute;
    public boolean allowSafeFilter = true;
    public boolean allowInlineHandlers = true;
    public boolean allowJavaScriptUrls = true;
    public boolean allowScriptTags = true;
    public String actionUrls = "any";

    public static ViewPolicy starter() {
        ViewPolicy policy = new ViewPolicy();
        policy.requireVersion = true;
        policy.requireTitle = true;
        policy.requireRoute = true;
        policy.allowSafeFilter = false;
        policy.allowInlineHandlers = false;
        policy.allowJavaScriptUrls = false;
        policy.allowScriptTags = false;
        policy.actionUrls = "relative-only";
        return policy;
    }
}
