package com.Problemint.ai;

import java.util.*;

public class ComplaintUnderstandingEngine {

    public static class AnalysisResult {
        public String category;
        public String severity;
        public String summary;
        public List<String> keywords;
        public double confidence;

        public AnalysisResult(String category, String severity, String summary, List<String> keywords, double confidence) {
            this.category = category;
            this.severity = severity;
            this.summary = summary;
            this.keywords = keywords;
            this.confidence = confidence;
        }
    }

    public static AnalysisResult analyze(String complaintText) {
        if (complaintText == null || complaintText.isEmpty()) {
            return new AnalysisResult("General", "Low", "Empty complaint", new ArrayList<>(), 0.0);
        }

        String lower = complaintText.toLowerCase();
        String category = "General";
        String severity = "Medium";
        double confidence = 0.85;
        List<String> keywords = new ArrayList<>();

        // Simple keyword-based categorization
        if (lower.contains("water") || lower.contains("plumbing")) {
            category = "Plumbing";
            severity = "Medium";
            keywords.addAll(Arrays.asList("water", "leak", "pipe"));
        } else if (lower.contains("electrical") || lower.contains("power")) {
            category = "Electrical";
            severity = "High";
            keywords.addAll(Arrays.asList("electrical", "power", "wire"));
        } else if (lower.contains("network") || lower.contains("internet")) {
            category = "IT Infrastructure";
            severity = "Medium";
            keywords.addAll(Arrays.asList("network", "internet", "connection"));
        } else if (lower.contains("maintenance") || lower.contains("repair")) {
            category = "Maintenance";
            severity = "Low";
            keywords.addAll(Arrays.asList("maintenance", "repair", "fix"));
        }

        String summary = complaintText.length() > 100 ? complaintText.substring(0, 100) + "..." : complaintText;
        return new AnalysisResult(category, severity, summary, keywords, confidence);
    }
}
