package dev.tosiiko.cup;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public final class CupValidator {
    private CupValidator() {}

    public static void validateView(Map<String, Object> view) {
        List<String> issues = new ArrayList<>();

        Object template = view.get("template");
        if (!(template instanceof String str) || str.isBlank()) {
            issues.add("view.template must be a string");
        }

        Object state = view.get("state");
        if (!(state instanceof Map<?, ?>)) {
            issues.add("view.state must be an object");
        }

        Object meta = view.get("meta");
        if (!(meta instanceof Map<?, ?> metaMap)) {
            issues.add("view.meta must be an object");
        } else {
            Object version = metaMap.get("version");
            if (!"1".equals(version)) {
                issues.add("view.meta.version must be \"1\"");
            }
        }

        Object actions = view.get("actions");
        if (actions instanceof Map<?, ?> actionMap) {
            for (Map.Entry<?, ?> entry : actionMap.entrySet()) {
                if (!(entry.getValue() instanceof Map<?, ?> descriptor)) {
                    issues.add("view.actions." + entry.getKey() + " must be an object");
                    continue;
                }
                Object type = descriptor.get("type");
                if (!("fetch".equals(type) || "emit".equals(type) || "navigate".equals(type))) {
                    issues.add("view.actions." + entry.getKey() + ".type must be one of fetch, emit, navigate");
                }
            }
        }

        if (!issues.isEmpty()) {
            throw new ValidationError(issues);
        }
    }

    public static void validateViewPolicy(Map<String, Object> view, ViewPolicy policy) {
        validateView(view);
        List<String> issues = new ArrayList<>();

        @SuppressWarnings("unchecked")
        Map<String, Object> meta = (Map<String, Object>) view.get("meta");
        String template = String.valueOf(view.get("template"));

        if (policy.requireVersion && !"1".equals(meta.get("version"))) {
            issues.add("view.meta.version is required by policy");
        }
        if (policy.requireTitle && blank(meta.get("title"))) {
            issues.add("view.meta.title is required by policy");
        }
        if (policy.requireRoute && blank(meta.get("route"))) {
            issues.add("view.meta.route is required by policy");
        }
        if (!policy.allowSafeFilter && template.contains("|safe")) {
            issues.add("view.template uses the |safe filter, which is disabled by policy");
        }
        if (!policy.allowScriptTags && template.toLowerCase().contains("<script")) {
            issues.add("view.template contains a <script> tag, which is disabled by policy");
        }
        if (!policy.allowInlineHandlers && template.toLowerCase().contains("onclick=")) {
            issues.add("view.template contains inline event handler attributes, which are disabled by policy");
        }
        if (!policy.allowJavaScriptUrls && template.toLowerCase().contains("javascript:")) {
            issues.add("view.template contains a javascript: URL, which is disabled by policy");
        }

        if ("relative-only".equals(policy.actionUrls) && view.get("actions") instanceof Map<?, ?> actionMap) {
            for (Map.Entry<?, ?> entry : actionMap.entrySet()) {
                if (entry.getValue() instanceof Map<?, ?> descriptor) {
                    Object type = descriptor.get("type");
                    Object url = descriptor.get("url");
                    if (("fetch".equals(type) || "navigate".equals(type)) && url instanceof String urlValue && !relativeUrl(urlValue)) {
                        issues.add("view.actions." + entry.getKey() + ".url must stay relative under the current policy");
                    }
                }
            }
        }

        if (!issues.isEmpty()) {
            throw new PolicyError(issues);
        }
    }

    private static boolean blank(Object value) {
        return !(value instanceof String str) || str.isBlank();
    }

    private static boolean relativeUrl(String value) {
        return value.startsWith("/")
            || value.startsWith("./")
            || value.startsWith("../")
            || value.startsWith("?")
            || value.startsWith("#");
    }
}
