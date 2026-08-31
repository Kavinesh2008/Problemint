package com.Problemint.ai;

import com.Problemint.model.Complaint;
import com.Problemint.repository.DatabaseInitializer;
import java.util.*;
import java.util.stream.Collectors;

public class RelatedComplaintEngine {

    public static class SimilarityResult {
        public Complaint complaint;
        public int similarityPercentage;
        public String matchReason;

        public SimilarityResult(Complaint complaint, int similarityPercentage, String matchReason) {
            this.complaint = complaint;
            this.similarityPercentage = similarityPercentage;
            this.matchReason = matchReason;
        }
    }

    public static List<SimilarityResult> findSimilarComplaints(String text, String category, String location) {
        List<SimilarityResult> results = new ArrayList<>();
        if (text == null) text = "";
        String lowerText = text.toLowerCase();
        Set<String> words = new HashSet<>(Arrays.asList(lowerText.split("\\W+")));

        for (Complaint c : DatabaseInitializer.getComplaints().values()) {
            if (c.getComplaintText() == null) continue;
            int score = 0;
            String reason = "";

            // Location match (35%)
            if (location != null && c.getLocation() != null && c.getLocation().equalsIgnoreCase(location)) {
                score += 35;
                reason = "Same location (" + location + ")";
            }

            // Category match (30%)
            if (category != null && c.getCategory() != null && c.getCategory().equalsIgnoreCase(category)) {
                score += 30;
                if (!reason.isEmpty()) reason += ", ";
                reason += "Same category (" + category + ")";
            }

            // Keyword overlap (up to 35%)
            Set<String> targetWords = new HashSet<>(Arrays.asList(c.getComplaintText().toLowerCase().split("\\W+")));
            int overlap = 0;
            for (String w : words) {
                if (w.length() > 3 && targetWords.contains(w)) {
                    overlap++;
                }
            }

            int keywordScore = Math.min(35, overlap * 10);
            score += keywordScore;

            if (score >= 60) {
                results.add(new SimilarityResult(c, Math.min(99, score), reason));
            }
        }

        results.sort((a, b) -> Integer.compare(b.similarityPercentage, a.similarityPercentage));
        return results.stream().limit(5).collect(Collectors.toList());
    }
}
