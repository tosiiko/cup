package dev.tosiiko.cup;

import java.util.Map;

public interface ActionDescriptor {
    String type();
    Map<String, Object> toMap();
}
