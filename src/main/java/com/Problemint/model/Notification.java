package com.Problemint.model;

import java.util.Objects;

public class Notification {
    private int id;
    private int userId;
    private String notificationId;
    private String userIdStr;
    private String message;
    private String type;
    private String title;
    private String description;
    private boolean read;
    private String sourceEntity;
    private int sourceEntityId;
    private String timestamp;

    public Notification() {}

    public Notification(int id, int userId, String message, String type, boolean read,
                       String sourceEntity, int sourceEntityId) {
        this.id = id;
        this.userId = userId;
        this.message = message;
        this.type = type;
        this.read = read;
        this.sourceEntity = sourceEntity;
        this.sourceEntityId = sourceEntityId;
    }

    // String-based constructor for API usage
    public Notification(String notificationId, String userIdStr, String type, String title, String description, String sourceEntity, String timestamp) {
        this.notificationId = notificationId;
        this.userIdStr = userIdStr;
        this.type = type;
        this.title = title;
        this.description = description;
        this.sourceEntity = sourceEntity;
        this.timestamp = timestamp;
        this.read = false;
    }

    // Getters and Setters
    public int getId() { return id; }
    public void setId(int id) { this.id = id; }

    public String getNotificationId() { return notificationId; }
    public void setNotificationId(String notificationId) { this.notificationId = notificationId; }

    public int getUserId() { return userId; }
    public void setUserId(int userId) { this.userId = userId; }

    public String getUserIdStr() { return userIdStr; }
    public void setUserIdStr(String userIdStr) { this.userIdStr = userIdStr; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public boolean isRead() { return read; }
    public void setRead(boolean read) { this.read = read; }

    public String getSourceEntity() { return sourceEntity; }
    public void setSourceEntity(String sourceEntity) { this.sourceEntity = sourceEntity; }

    public int getSourceEntityId() { return sourceEntityId; }
    public void setSourceEntityId(int sourceEntityId) { this.sourceEntityId = sourceEntityId; }

    public String getTimestamp() { return timestamp; }
    public void setTimestamp(String timestamp) { this.timestamp = timestamp; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Notification that = (Notification) o;
        return id == that.id;
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }

    @Override
    public String toString() {
        return "Notification{" + "id=" + id + ", type='" + type + '\'' + ", read=" + read + '}';
    }
}
