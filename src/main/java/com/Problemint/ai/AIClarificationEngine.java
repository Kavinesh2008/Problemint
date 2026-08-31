package com.Problemint.ai;

import java.util.*;

public class AIClarificationEngine {

    public static class Question {
        public String field;
        public String text;
        public List<String> options;

        public Question(String field, String text, List<String> options) {
            this.field = field;
            this.text = text;
            this.options = options;
        }
    }

    public static List<Question> generateClarificationQuestions(String text) {
        List<Question> questions = new ArrayList<>();
        if (text == null) text = "";
        String lower = text.toLowerCase();

        if (!lower.contains("block") && !lower.contains("hall") && !lower.contains("lab") && !lower.contains("canteen")) {
            questions.add(new Question("location", "Which specific location or block is experiencing this problem?",
                    Arrays.asList("Block A - Hostel", "Block B - Hostel", "Block C - Hostel", "CSE Block", "Computer Lab 1", "Canteen")));
        }

        if (!lower.contains("everyone") && !lower.contains("only my") && !lower.contains("room") && !lower.contains("floor")) {
            questions.add(new Question("scope", "Does this problem affect your specific unit or multiple floors/rooms?",
                    Arrays.asList("Only my room/tap", "Entire floor", "Entire building/block")));
        }

        if (!lower.contains("today") && !lower.contains("yesterday") && !lower.contains("days") && !lower.contains("evening") && !lower.contains("morning")) {
            questions.add(new Question("timeframe", "When did you first notice this issue?",
                    Arrays.asList("Just now", "Earlier today", "2-3 days ago", "Over a week")));
        }

        if (questions.isEmpty()) {
            questions.add(new Question("additional", "Does the problem occur continuously or strictly at peak usage hours?",
                    Arrays.asList("Peak evening hours (6 PM - 9 PM)", "Peak morning hours (8 AM - 11 AM)", "Continuously all day")));
        }

        return questions;
    }
}
