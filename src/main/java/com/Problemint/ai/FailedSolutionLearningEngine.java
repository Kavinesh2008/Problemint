package com.Problemint.ai;

import com.Problemint.model.KnowledgeItem;
import com.Problemint.model.Resolution;
import com.Problemint.repository.DatabaseInitializer;
import java.util.*;

public class FailedSolutionLearningEngine {

    public static class FailedSolutionWarning {
        public boolean isBlocked;
        public String warningMessage;
        public String historicallyFailedSolution;
        public String recommendedAlternative;

        public FailedSolutionWarning(boolean isBlocked, String warningMessage, String historicallyFailedSolution, String recommendedAlternative) {
            this.isBlocked = isBlocked;
            this.warningMessage = warningMessage;
            this.historicallyFailedSolution = historicallyFailedSolution;
            this.recommendedAlternative = recommendedAlternative;
        }
    }

    public static FailedSolutionWarning evaluateAction(String incidentId, String proposedAction, String actionType) {
        if (proposedAction == null) return new FailedSolutionWarning(false, null, null, null);
        String proposedLower = proposedAction.toLowerCase();

        // 1. Check direct historical failed resolutions for this incident
        for (Resolution res : DatabaseInitializer.getResolutions().values()) {
            if (incidentId != null && incidentId.equalsIgnoreCase(res.getIncidentId())) {
                if (!res.isSuccess() && res.getActionTaken() != null) {
                    if (proposedLower.contains(res.getActionTaken().toLowerCase()) || res.getActionTaken().toLowerCase().contains(proposedLower)) {
                        return new FailedSolutionWarning(
                                true,
                                "WARNING: Attempting '" + res.getActionTaken() + "' previously FAILED for Incident " + incidentId + " (Attempt #" + res.getAttemptNumber() + "). PROBLEMINT blocked this repetitive action.",
                                res.getActionTaken(),
                                "Recommend hardware replacement or permanent infrastructure upgrade based on historical learning."
                        );
                    }
                }
            }
        }

        // 2. Check Knowledge Base for historically ineffective solutions for similar problem types
        for (KnowledgeItem kb : DatabaseInitializer.getKnowledgeItems().values()) {
            if (kb.getFailedSolution() != null && !kb.getFailedSolution().isEmpty()) {
                String failedLower = kb.getFailedSolution().toLowerCase();
                if (proposedLower.contains("reboot") && failedLower.contains("reboot") ||
                    proposedLower.contains("clean") && failedLower.contains("clean") ||
                    proposedLower.contains("flush") && failedLower.contains("flush") ||
                    proposedLower.contains("patch") && failedLower.contains("patch")) {

                    if (incidentId != null && kb.getIncidentId() != null && incidentId.equalsIgnoreCase(kb.getIncidentId())) {
                        return new FailedSolutionWarning(
                                true,
                                "FAILED-SOLUTION MEMORY ALERT: Knowledge Item " + kb.getKnowledgeId() + " records that '" + kb.getFailedSolution() + "' failed (Success Rate 0%). System prevents repeating failed temporary fixes.",
                                kb.getFailedSolution(),
                                "Successful Solution: " + kb.getSuccessfulSolution()
                        );
                    }
                }
            }
        }

        return new FailedSolutionWarning(false, "Action permitted.", null, null);
    }
}
