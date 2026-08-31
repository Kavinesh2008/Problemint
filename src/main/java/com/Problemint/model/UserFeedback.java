package com.Problemint.model;

import java.time.LocalDateTime;
import java.util.Objects;

public class UserFeedback {
    private int id;
    private int userId;
    private int complaintId;
    private int rating;
    private String comment;
    private LocalDateTime submittedAt;
    private String category;

    public UserFeedback() {}

    public UserFeedback(int id, int userId, int complaintId, int rating, String comment,
                       LocalDateTime submittedAt, String category) {
        this.id = id;
        this.userId = userId;
        this.complaintId = complaintId;
        this.rating = rating;
        this.comment = comment;
        this.submittedAt = submittedAt;
        this.category = category;
    }

    // Getters and Setters
    public int getId() { return id; }
    public void setId(int id) { this.id = id; }

    public int getUserId() { return userId; }
    public void setUserId(int userId) { this.userId = userId; }

    public int getComplaintId() { return complaintId; }
    public void setComplaintId(int complaintId) { this.complaintId = complaintId; }

    public int getRating() { return rating; }
    public void setRating(int rating) { this.rating = rating; }

    public String getComment() { return comment; }
    public void setComment(String comment) { this.comment = comment; }

    public LocalDateTime getSubmittedAt() { return submittedAt; }
    public void setSubmittedAt(LocalDateTime submittedAt) { this.submittedAt = submittedAt; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        UserFeedback that = (UserFeedback) o;
        return id == that.id;
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }

    @Override
    public String toString() {
        return "UserFeedback{" + "id=" + id + ", rating=" + rating + ", category='" + category + '\'' + '}';
    }
}
