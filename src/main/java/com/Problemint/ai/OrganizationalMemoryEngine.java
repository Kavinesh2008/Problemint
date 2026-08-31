package com.Problemint.ai;

import com.Problemint.model.Incident;
import com.Problemint.model.KnowledgeItem;
import com.Problemint.model.Resolution;
import com.Problemint.repository.DatabaseInitializer;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

public class OrganizationalMemoryEngine {

    public static KnowledgeItem storeMemory(Incident incident, Resolution successfulResolution, String failedAttemptSummary, String lesson) {
        if (incident == null) return null;

        String id = "KNB-" + String.format("%05d", DatabaseInitializer.getKnowledgeItems().size() + 1);
        KnowledgeItem kb = new KnowledgeItem();
        kb.setKnowledgeId(id);
        kb.setIncidentId(incident.getIncidentId());
        kb.setProblemType(incident.getCategory());
        kb.setProblemDescription(incident.getTitle());
        kb.setLocation(incident.getLocation());
        kb.setRootCause(incident.getPossibleRootCause() != null ? incident.getPossibleRootCause() : "Infrastructure Degradation");
        kb.setRootCauseConfidence(incident.getRootCauseConfidence());
        kb.setSolutionAttempted(successfulResolution != null ? successfulResolution.getActionTaken() : "Standard Resolution Protocol");
        kb.setSuccessfulSolution(successfulResolution != null ? successfulResolution.getActionTaken() : "Replaced component hardware");
        kb.setFailedSolution(failedAttemptSummary != null && !failedAttemptSummary.isEmpty() ? failedAttemptSummary : "Soft rebooting / temporary patch");
        kb.setOutcome("Issue Resolved & User Verified");
        kb.setResolutionTimeHours(successfulResolution != null ? successfulResolution.getResolutionTimeHours() : 4.5);
        kb.setSuccessRate("100%");
        kb.setLessonLearned(lesson != null ? lesson : "Temporary soft fixes fail under high usage; physical component replacement yields permanent fix.");
        kb.setRecommendedFutureAction("Schedule regular preventive inspections and stock replacement hardware locally.");
        kb.setCreatedFromIncident(incident.getIncidentId());
        kb.setLastUpdated(LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd")));

        DatabaseInitializer.saveKnowledgeItem(kb);
        System.out.println("[ORGANIZATIONAL MEMORY] Preserved Knowledge Item " + id + " for Incident " + incident.getIncidentId());
        return kb;
    }
}
