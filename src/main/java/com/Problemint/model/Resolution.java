package com.Problemint.model;

import java.time.LocalDateTime;
import java.util.Objects;

public class Resolution {
    private int id;
    private int complaintId;
    private String incidentId;
    private String title;
    private String description;
    private String status;
    private LocalDateTime appliedAt;
    private String appliedBy;
    private int effectivenessScore;
    private int attemptNumber;
    private String actionTaken;
    private String performedBy;
    private String actionType;
    private String outcome;
    private boolean success;
    private double resolutionTimeHours;
    private String performedAt;
    private String resolutionStatus;

    public Resolution() {}

    public Resolution(int id, int complaintId, String title, String description, String status,
                     LocalDateTime appliedAt, String appliedBy, int effectivenessScore) {
        this.id = id;
        this.complaintId = complaintId;
        this.title = title;
        this.description = description;
        this.status = status;
        this.appliedAt = appliedAt;
        this.appliedBy = appliedBy;
        this.effectivenessScore = effectivenessScore;
    }

    // Getters and Setters
    public int getId() { return id; }
    public void setId(int id) { this.id = id; }

    public int getComplaintId() { return complaintId; }
    public void setComplaintId(int complaintId) { this.complaintId = complaintId; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public LocalDateTime getAppliedAt() { return appliedAt; }
    public void setAppliedAt(LocalDateTime appliedAt) { this.appliedAt = appliedAt; }

    public String getAppliedBy() { return appliedBy; }
    public void setAppliedBy(String appliedBy) { this.appliedBy = appliedBy; }

    public int getEffectivenessScore() { return effectivenessScore; }
    public void setEffectivenessScore(int effectivenessScore) { this.effectivenessScore = effectivenessScore; }

    public String getIncidentId() { return incidentId; }
    public void setIncidentId(String incidentId) { this.incidentId = incidentId; }

    public int getAttemptNumber() { return attemptNumber; }
    public void setAttemptNumber(int attemptNumber) { this.attemptNumber = attemptNumber; }

    public String getActionTaken() { return actionTaken; }
    public void setActionTaken(String actionTaken) { this.actionTaken = actionTaken; }

    public String getPerformedBy() { return performedBy; }
    public void setPerformedBy(String performedBy) { this.performedBy = performedBy; }

    public String getActionType() { return actionType; }
    public void setActionType(String actionType) { this.actionType = actionType; }

    public String getOutcome() { return outcome; }
    public void setOutcome(String outcome) { this.outcome = outcome; }

    public boolean isSuccess() { return success; }
    public void setSuccess(boolean success) { this.success = success; }

    public double getResolutionTimeHours() { return resolutionTimeHours; }
    public void setResolutionTimeHours(double resolutionTimeHours) { this.resolutionTimeHours = resolutionTimeHours; }

    public String getPerformedAt() { return performedAt; }
    public void setPerformedAt(String performedAt) { this.performedAt = performedAt; }

    public String getResolutionStatus() { return resolutionStatus; }
    public void setResolutionStatus(String resolutionStatus) { this.resolutionStatus = resolutionStatus; }

    public int getEffectivenessScore() { return effectivenessScore; }
    public void setEffectivenessScore(int effectivenessScore) { this.effectivenessScore = effectivenessScore; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Resolution that = (Resolution) o;
        return id == that.id;
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }

    @Override
    public String toString() {
        return "Resolution{" + "id=" + id + ", title='" + title + '\'' + ", status='" + status + '\'' + '}';
    }
}
