package dev.tosiiko.cup;

import java.util.LinkedHashMap;
import java.util.Map;

public final class EmitAction implements ActionDescriptor {
    private final String event;
    private Map<String, Object> detail;

    public EmitAction(String event) {
        this.event = event;
    }

    public EmitAction detail(Map<String, Object> detail) {
        this.detail = detail;
        return this;
    }

    @Override
    public String type() {
        return "emit";
    }

    @Override
    public Map<String, Object> toMap() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("type", type());
        out.put("event", event);
        if (detail != null && !detail.isEmpty()) {
            out.put("detail", detail);
        }
        return out;
    }
}
