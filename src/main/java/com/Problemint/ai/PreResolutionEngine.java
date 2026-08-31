package com.Problemint.ai;

import java.util.*;

public class PreResolutionEngine {

    public static class PreResolutionRecommendation {
        public String title;
        public String description;
        public List<String> steps;
        public String existingIncidentNotice;
        public String existingIncidentId;

        public PreResolutionRecommendation() {}
    }

    public static PreResolutionRecommendation getSuggestions(String category, String location) {
        PreResolutionRecommendation rec = new PreResolutionRecommendation();
        rec.steps = new ArrayList<>();

        if ("Water & Sanitation".equalsIgnoreCase(category)) {
            rec.title = "Temporary Maintenance Board Check";
            rec.description = "Your issue may be related to scheduled booster pump maintenance in " + location + ". Check the maintenance board first.";
            rec.steps.add("Check if the main water supply valve on your floor is fully open.");
            rec.steps.add("Verify whether adjacent rooms/units are experiencing low pressure.");
            rec.steps.add("Check the campus Facilities Notice Board for active scheduled maintenance.");
            rec.existingIncidentNotice = "A similar issue (#INC-016: Block B Water Supply Issue) is already being investigated in your location.";
            rec.existingIncidentId = "INC-016";
        } else if ("Internet & Network".equalsIgnoreCase(category)) {
            rec.title = "Network Self-Troubleshooting Steps";
            rec.description = "Before submitting a ticket, try these quick troubleshooting steps for " + location + ".";
            rec.steps.add("Disconnect and reconnect to the campus Wi-Fi network.");
            rec.steps.add("Forget the network configuration and log in with your credentials again.");
            rec.steps.add("Check if device power saving mode is disabling the Wi-Fi adapter.");
            rec.existingIncidentNotice = "A active network incident (#INC-005) is currently under maintenance in " + location + ".";
            rec.existingIncidentId = "INC-005";
        } else {
            rec.title = "General Facility Inspection";
            rec.description = "Please review common troubleshooting guidance before submitting a formal request.";
            rec.steps.add("Inspect local switchboards and breaker switches.");
            rec.steps.add("Confirm if maintenance staff have already posted a notice nearby.");
            rec.existingIncidentNotice = null;
        }

        return rec;
    }
}
