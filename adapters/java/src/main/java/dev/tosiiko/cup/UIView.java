package dev.tosiiko.cup;

import java.util.LinkedHashMap;
import java.util.Map;

public final class UIView {
    public static final String ADAPTER_NAME = "java-cup";
    public static final String PROTOCOL_VERSION = "1";
    public static final String GENERATOR = "java-cup/0.2.0";

    private final String template;
    private final Map<String, Object> state = new LinkedHashMap<>();
    private final Map<String, ActionDescriptor> actions = new LinkedHashMap<>();
    private String title;
    private String route;

    public UIView(String template) {
        this.template = template;
    }

    public UIView state(String key, Object value) {
        state.put(key, value);
        return this;
    }

    public UIView state(Map<String, Object> values) {
        state.putAll(values);
        return this;
    }

    public UIView action(String name, ActionDescriptor descriptor) {
        actions.put(name, descriptor);
        return this;
    }

    public UIView title(String title) {
        this.title = title;
        return this;
    }

    public UIView route(String route) {
        this.route = route;
        return this;
    }

    public Map<String, Object> toMap() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("template", template);
        out.put("state", state);

        if (!actions.isEmpty()) {
            Map<String, Object> actionMaps = new LinkedHashMap<>();
            for (Map.Entry<String, ActionDescriptor> entry : actions.entrySet()) {
                actionMaps.put(entry.getKey(), entry.getValue().toMap());
            }
            out.put("actions", actionMaps);
        }

        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("version", PROTOCOL_VERSION);
        meta.put("lang", "java");
        meta.put("generator", GENERATOR);
        if (title != null && !title.isBlank()) {
            meta.put("title", title);
        }
        if (route != null && !route.isBlank()) {
            meta.put("route", route);
        }
        out.put("meta", meta);
        return out;
    }

    public String toJson() {
        CupValidator.validateView(toMap());
        return JsonWriter.stringify(toMap());
    }
}
