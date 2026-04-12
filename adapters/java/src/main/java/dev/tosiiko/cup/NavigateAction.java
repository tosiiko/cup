package dev.tosiiko.cup;

import java.util.LinkedHashMap;
import java.util.Map;

public final class NavigateAction implements ActionDescriptor {
    private final String url;
    private boolean replace;

    public NavigateAction(String url) {
        this.url = url;
    }

    public NavigateAction replace(boolean replace) {
        this.replace = replace;
        return this;
    }

    @Override
    public String type() {
        return "navigate";
    }

    @Override
    public Map<String, Object> toMap() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("type", type());
        out.put("url", url);
        if (replace) {
            out.put("replace", true);
        }
        return out;
    }
}
