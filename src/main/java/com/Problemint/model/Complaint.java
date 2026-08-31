package com.Problemint.model;

import java.time.LocalDateTime;
import java.util.Objects;

public class Complaint {
    private int id;
    private String complaintId;
    private String title;
    private String description;
    private String category;
    private String status;
    private LocalDateTime createdAt;
    private String createdAtStr;
    private LocalDateTime updatedAt;
    private String priority;
    private String customerId;
    private String complaintText;
    private String subcategory;
    private String location;
    private String department;
    private String severity;
    private String impact;
    private String incidentId;
    private String source;
    private String userId;
    private boolean hasEvidence;

    public Complaint() {}

    public Complaint(int id, String title, String description, String category, String status, 
                     LocalDateTime createdAt, LocalDateTime updatedAt, String priority, String customerId) {
        this.id = id;
        this.title = title;
        this.description = description;
        this.category = category;
        this.status = status;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
        this.priority = priority;
        this.customerId = customerId;
    }

    // Getters and Setters
    public int getId() { return id; }
    public void setId(int id) { this.id = id; }

    public String getComplaintId() { return complaintId; }
    public void setComplaintId(String complaintId) { this.complaintId = complaintId; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAtStr = createdAt; }
    public String getCreatedAtStr() { return createdAtStr; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public String getPriority() { return priority; }
    public void setPriority(String priority) { this.priority = priority; }

    public String getCustomerId() { return customerId; }
    public void setCustomerId(String customerId) { this.customerId = customerId; }

    public String getComplaintText() { return complaintText; }
    public void setComplaintText(String complaintText) { this.complaintText = complaintText; }

    public String getSubcategory() { return subcategory; }
    public void setSubcategory(String subcategory) { this.subcategory = subcategory; }

    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }

    public String getDepartment() { return department; }
    public void setDepartment(String department) { this.department = department; }

    public String getSeverity() { return severity; }
    public void setSeverity(String severity) { this.severity = severity; }

    public String getImpact() { return impact; }
    public void setImpact(String impact) { this.impact = impact; }

    public String getIncidentId() { return incidentId; }
    public void setIncidentId(String incidentId) { this.incidentId = incidentId; }

    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public boolean isHasEvidence() { return hasEvidence; }
    public void setHasEvidence(boolean hasEvidence) { this.hasEvidence = hasEvidence; }

    public String getResolutionStatus() { return status; }
    public void setResolutionStatus(String resolutionStatus) { this.status = resolutionStatus; }

    public boolean isUserVerified() { return false; }
    public void setUserVerified(boolean userVerified) { }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Complaint complaint = (Complaint) o;
        return id == complaint.id;
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }

    @Override
    public String toString() {
        return "Complaint{" + "id=" + id + ", title='" + title + '\'' + ", status='" + status + '\'' + '}';
    }
}
