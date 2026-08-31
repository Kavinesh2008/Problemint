package com.Problemint.util;

import java.util.*;

public class SimpleJson {

    public static String toJson(Object obj) {
        if (obj == null) return "null";
        if (obj instanceof String) return "\"" + escapeString((String) obj) + "\"";
        if (obj instanceof Number) return obj.toString();
        if (obj instanceof Boolean) return obj.toString();
        if (obj instanceof Map) return mapToJson((Map<?, ?>) obj);
        if (obj instanceof Collection) return collectionToJson((Collection<?>) obj);
        return "\"" + escapeString(obj.toString()) + "\"";
    }

    private static String mapToJson(Map<?, ?> map) {
        StringBuilder sb = new StringBuilder("{");
        map.forEach((k, v) -> {
            if (sb.length() > 1) sb.append(",");
            sb.append("\"").append(escapeString(k.toString())).append("\":")
                    .append(toJson(v));
        });
        sb.append("}");
        return sb.toString();
    }

    private static String collectionToJson(Collection<?> collection) {
        StringBuilder sb = new StringBuilder("[");
        collection.forEach(item -> {
            if (sb.length() > 1) sb.append(",");
            sb.append(toJson(item));
        });
        sb.append("]");
        return sb.toString();
    }

    private static String escapeString(String str) {
        return str.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }

    public static Map<String, Object> parseMap(String json) {
        return fromJson(json);
    }

    public static Map<String, Object> fromJson(String json) {
        // Simple JSON parser for basic objects
        Map<String, Object> result = new HashMap<>();
        if (json == null || json.trim().isEmpty()) return result;

        String cleaned = json.trim();
        if (cleaned.startsWith("{") && cleaned.endsWith("}")) {
            cleaned = cleaned.substring(1, cleaned.length() - 1);
            String[] pairs = cleaned.split(",");
            for (String pair : pairs) {
                String[] kv = pair.split(":", 2);
                if (kv.length == 2) {
                    String key = kv[0].trim().replaceAll("\"", "");
                    String value = kv[1].trim().replaceAll("\"", "");
                    result.put(key, value);
                }
            }
        }
        return result;
    }
}
