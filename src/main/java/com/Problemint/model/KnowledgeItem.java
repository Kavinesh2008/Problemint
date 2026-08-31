package com.Problemint.model;

import java.util.Objects;

public class KnowledgeItem {
    private int id;
    private String knowledgeId;
    private String title;
    private String content;
    private String category;
    private String source;
    private int relevanceScore;
    private String status;

    public KnowledgeItem() {}

    public KnowledgeItem(int id, String title, String content, String category, String source,
                        int relevanceScore, String status) {
        this.id = id;
        this.title = title;
        this.content = content;
        this.category = category;
        this.source = source;
        this.relevanceScore = relevanceScore;
        this.status = status;
    }

    // Getters and Setters
    public int getId() { return id; }
    public void setId(int id) { this.id = id; }

    public String getKnowledgeId() { return knowledgeId; }
    public void setKnowledgeId(String knowledgeId) { this.knowledgeId = knowledgeId; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }

    public int getRelevanceScore() { return relevanceScore; }
    public void setRelevanceScore(int relevanceScore) { this.relevanceScore = relevanceScore; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        KnowledgeItem that = (KnowledgeItem) o;
        return id == that.id;
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }

    @Override
    public String toString() {
        return "KnowledgeItem{" + "id=" + id + ", title='" + title + '\'' + '}';
    }
}
