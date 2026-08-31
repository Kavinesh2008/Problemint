package com.Problemint.model;

import java.util.Objects;

public class PreventionRecommendation {
    private int id;
    private String recommendationId;
    private int incidentId;
    private String incidentIdStr;
    private String recommendation;
    private String priority;
    private String category;
    private String status;
    private int implementationDays;
    private String problem;
    private String reason;
    private String evidence;
    private String riskLevel;
    private String expectedImpact;
    private String suggestedTimeline;
    private String responsibleDepartment;
    private String recommendedActionType;
    private String createdAt;
    private boolean basedOnPreviousIncident;
    private int supportingComplaintCount;

    public PreventionRecommendation() {}

    public PreventionRecommendation(int id, String recommendationId, int incidentId, String recommendation, String priority,
                                   String category, String status, int implementationDays) {
        this.id = id;
        this.recommendationId = recommendationId;
        this.incidentId = incidentId;
        this.recommendation = recommendation;
        this.priority = priority;
        this.category = category;
        this.status = status;
        this.implementationDays = implementationDays;
    }

    // Getters and Setters
    public int getId() { return id; }
    public void setId(int id) { this.id = id; }

    public String getRecommendationId() { return recommendationId; }
    public void setRecommendationId(String recommendationId) { this.recommendationId = recommendationId; }

    public int getIncidentId() { return incidentId; }
    public void setIncidentId(int incidentId) { this.incidentId = incidentId; }
    public void setIncidentId(String incidentId) { this.incidentIdStr = incidentId; }

    public String getIncidentIdStr() { return incidentIdStr; }
    public void setIncidentIdStr(String incidentIdStr) { this.incidentIdStr = incidentIdStr; }

    public String getRecommendation() { return recommendation; }
    public void setRecommendation(String recommendation) { this.recommendation = recommendation; }

    public String getPriority() { return priority; }
    public void setPriority(String priority) { this.priority = priority; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public int getImplementationDays() { return implementationDays; }
    public void setImplementationDays(int implementationDays) { this.implementationDays = implementationDays; }

    public String getProblem() { return problem; }
    public void setProblem(String problem) { this.problem = problem; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }

    public String getEvidence() { return evidence; }
    public void setEvidence(String evidence) { this.evidence = evidence; }

    public String getRiskLevel() { return riskLevel; }
    public void setRiskLevel(String riskLevel) { this.riskLevel = riskLevel; }

    public String getExpectedImpact() { return expectedImpact; }
    public void setExpectedImpact(String expectedImpact) { this.expectedImpact = expectedImpact; }

    public String getSuggestedTimeline() { return suggestedTimeline; }
    public void setSuggestedTimeline(String suggestedTimeline) { this.suggestedTimeline = suggestedTimeline; }

    public String getResponsibleDepartment() { return responsibleDepartment; }
    public void setResponsibleDepartment(String responsibleDepartment) { this.responsibleDepartment = responsibleDepartment; }

    public String getRecommendedActionType() { return recommendedActionType; }
    public void setRecommendedActionType(String recommendedActionType) { this.recommendedActionType = recommendedActionType; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }

    public boolean isBasedOnPreviousIncident() { return basedOnPreviousIncident; }
    public void setBasedOnPreviousIncident(boolean basedOnPreviousIncident) { this.basedOnPreviousIncident = basedOnPreviousIncident; }

    public int getSupportingComplaintCount() { return supportingComplaintCount; }
    public void setSupportingComplaintCount(int supportingComplaintCount) { this.supportingComplaintCount = supportingComplaintCount; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        PreventionRecommendation that = (PreventionRecommendation) o;
        return id == that.id;
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }

    @Override
    public String toString() {
        return "PreventionRecommendation{" + "id=" + id + ", priority='" + priority + '\'' + '}';
    }
}
