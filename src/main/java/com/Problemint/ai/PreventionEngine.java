package com.Problemint.ai;

import com.Problemint.model.Incident;
import com.Problemint.model.PreventionRecommendation;
import com.Problemint.repository.DatabaseInitializer;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;


public class PreventionEngine {

    public static PreventionRecommendation generateRecommendation(Incident incident) {
        if (incident == null) return null;

        String id = "REC-" + String.format("%05d", DatabaseInitializer.getPreventionRecommendations().size() + 1);
        PreventionRecommendation rec = new PreventionRecommendation();
        rec.setRecommendationId(id);
        rec.setIncidentId(incident.getIncidentId());
        rec.setProblem("Recurring " + incident.getCategory() + " issues in " + incident.getLocation());

        if (incident.getCategory().toLowerCase().contains("water")) {
            rec.setRecommendation("Inspect and replace secondary booster pump impellers and pressure transducers in " + incident.getLocation());
            rec.setReason("Historical usage pattern indicates booster pump impellers degrade after 12 months of high peak-evening traffic.");
            rec.setEvidence("11 grouped complaints logged over 48h; previous manual valve adjustments failed to sustain pressure.");
            rec.setRiskLevel("High");
            rec.setPriority("High");
            rec.setExpectedImpact("Guarantee continuous 24/7 water supply pressure across all floors.");
            rec.setSuggestedTimeline("Within 48 hours");
            rec.setResponsibleDepartment("Facilities & Maintenance");
            rec.setRecommendedActionType("Infrastructure Upgrade");
        } else if (incident.getCategory().toLowerCase().contains("internet") || incident.getCategory().toLowerCase().contains("network")) {
            rec.setRecommendation("Deploy dual high-density access point nodes and upgrade central edge router hardware.");
            rec.setReason("Bandwidth saturation occurs regularly during peak study hours; soft reboots provide zero permanent relief.");
            rec.setEvidence("Multiple complaints regarding 40% packet loss during evening hours.");
            rec.setRiskLevel("High");
            rec.setPriority("High");
            rec.setExpectedImpact("Eliminate network drops for 300+ active hostel users.");
            rec.setSuggestedTimeline("Within 7 days");
            rec.setResponsibleDepartment("IT Services");
            rec.setRecommendedActionType("Hardware Replacement");
        } else {
            rec.setRecommendation("Conduct comprehensive preventive inspection and upgrade component seals in " + incident.getLocation());
            rec.setReason("Recurring component wear detected by pattern analysis.");
            rec.setEvidence(incident.getComplaintCount() + " complaints logged across current month.");
            rec.setRiskLevel("Medium");
            rec.setPriority("Medium");
            rec.setExpectedImpact("Prevent emergency outages and reduce maintenance ticket volume by 40%.");
            rec.setSuggestedTimeline("Within 14 days");
            rec.setResponsibleDepartment(incident.getDepartment() != null ? incident.getDepartment() : "Operations");
            rec.setRecommendedActionType("Maintenance");
        }

        rec.setStatus("Approved");
        rec.setCreatedAt(LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd")));
        rec.setBasedOnPreviousIncident(true);
        rec.setSupportingComplaintCount(incident.getComplaintCount());

        DatabaseInitializer.savePreventionRecommendation(rec);
        return rec;
    }
}
