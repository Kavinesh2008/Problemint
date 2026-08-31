package com.Problemint.model;

import java.time.LocalDateTime;
import java.util.Objects;

public class Incident {
    private int id;
    private String incidentId;
    private int complaintId;
    private String type;
    private String severity;
    private String description;
    private LocalDateTime occurredAt;
    private LocalDateTime reportedAt;
    private LocalDateTime lastReportedAt;
    private LocalDateTime firstReportedAt;
    private String status;
    private String resolutionId;
    private String category;
    private String location;
    private String department;
    private int complaintCount;
    private String title;
    private String possibleRootCause;
    private double rootCauseConfidence;
    private String patternDetected;

    public Incident() {}

    public Incident(int id, String incidentId, int complaintId, String type, String severity, String description,
                    LocalDateTime occurredAt, LocalDateTime reportedAt, String status, String resolutionId) {
        this.id = id;
        this.incidentId = incidentId;
        this.complaintId = complaintId;
        this.type = type;
        this.severity = severity;
        this.description = description;
        this.occurredAt = occurredAt;
        this.reportedAt = reportedAt;
        this.status = status;
        this.resolutionId = resolutionId;
    }

    // Getters and Setters
    public int getId() { return id; }
    public void setId(int id) { this.id = id; }

    public String getIncidentId() { return incidentId; }
    public void setIncidentId(String incidentId) { this.incidentId = incidentId; }

    public int getComplaintId() { return complaintId; }
    public void setComplaintId(int complaintId) { this.complaintId = complaintId; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getSeverity() { return severity; }
    public void setSeverity(String severity) { this.severity = severity; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public LocalDateTime getOccurredAt() { return occurredAt; }
    public void setOccurredAt(LocalDateTime occurredAt) { this.occurredAt = occurredAt; }

    public LocalDateTime getReportedAt() { return reportedAt; }
    public void setReportedAt(LocalDateTime reportedAt) { this.reportedAt = reportedAt; }

    public LocalDateTime getLastReportedAt() { return lastReportedAt; }
    public void setLastReportedAt(LocalDateTime lastReportedAt) { this.lastReportedAt = lastReportedAt; }

    public LocalDateTime getFirstReportedAt() { return firstReportedAt; }
    public void setFirstReportedAt(LocalDateTime firstReportedAt) { this.firstReportedAt = firstReportedAt; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getResolutionStatus() { return resolutionId; }
    public void setResolutionStatus(String resolutionStatus) { this.resolutionId = resolutionStatus; }

    public String getResolutionId() { return resolutionId; }
    public void setResolutionId(String resolutionId) { this.resolutionId = resolutionId; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }

    public String getDepartment() { return department; }
    public void setDepartment(String department) { this.department = department; }

    public int getComplaintCount() { return complaintCount; }
    public void setComplaintCount(int complaintCount) { this.complaintCount = complaintCount; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getPossibleRootCause() { return possibleRootCause; }
    public void setPossibleRootCause(String possibleRootCause) { this.possibleRootCause = possibleRootCause; }

    public double getRootCauseConfidence() { return rootCauseConfidence; }
    public void setRootCauseConfidence(double rootCauseConfidence) { this.rootCauseConfidence = rootCauseConfidence; }

    public String getPatternDetected() { return patternDetected; }
    public void setPatternDetected(String patternDetected) { this.patternDetected = patternDetected; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Incident incident = (Incident) o;
        return id == incident.id;
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }

    @Override
    public String toString() {
        return "Incident{" + "id=" + id + ", type='" + type + '\'' + ", severity='" + severity + '\'' + '}';
    }
}
