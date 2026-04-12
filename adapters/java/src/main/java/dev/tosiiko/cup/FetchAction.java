package dev.tosiiko.cup;

import java.util.LinkedHashMap;
import java.util.Map;

public final class FetchAction implements ActionDescriptor {
    private final String url;
    private String method = "POST";
    private Map<String, Object> payload;

    public FetchAction(String url) {
        this.url = url;
    }

    public FetchAction method(String method) {
        this.method = method;
        return this;
    }

    public FetchAction payload(Map<String, Object> payload) {
        this.payload = payload;
        return this;
    }

    @Override
    public String type() {
        return "fetch";
    }

    @Override
    public Map<String, Object> toMap() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("type", type());
        out.put("url", url);
        out.put("method", method);
        if (payload != null && !payload.isEmpty()) {
            out.put("payload", payload);
        }
        return out;
    }
}
