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
    private String incidentId;
    private String problemType;
    private String problemDescription;
    private String location;
    private String rootCause;
    private double rootCauseConfidence;
    private String solutionAttempted;
    private String successfulSolution;
    private String failedSolution;
    private String outcome;
    private double resolutionTimeHours;
    private String successRate;
    private String lessonLearned;
    private String recommendedFutureAction;
    private String createdFromIncident;
    private String lastUpdated;

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

    public String getIncidentId() { return incidentId; }
    public void setIncidentId(String incidentId) { this.incidentId = incidentId; }

    public String getProblemType() { return problemType; }
    public void setProblemType(String problemType) { this.problemType = problemType; }

    public String getProblemDescription() { return problemDescription; }
    public void setProblemDescription(String problemDescription) { this.problemDescription = problemDescription; }

    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }

    public String getRootCause() { return rootCause; }
    public void setRootCause(String rootCause) { this.rootCause = rootCause; }

    public double getRootCauseConfidence() { return rootCauseConfidence; }
    public void setRootCauseConfidence(double rootCauseConfidence) { this.rootCauseConfidence = rootCauseConfidence; }

    public String getSolutionAttempted() { return solutionAttempted; }
    public void setSolutionAttempted(String solutionAttempted) { this.solutionAttempted = solutionAttempted; }

    public String getSuccessfulSolution() { return successfulSolution; }
    public void setSuccessfulSolution(String successfulSolution) { this.successfulSolution = successfulSolution; }

    public String getFailedSolution() { return failedSolution; }
    public void setFailedSolution(String failedSolution) { this.failedSolution = failedSolution; }

    public String getOutcome() { return outcome; }
    public void setOutcome(String outcome) { this.outcome = outcome; }

    public double getResolutionTimeHours() { return resolutionTimeHours; }
    public void setResolutionTimeHours(double resolutionTimeHours) { this.resolutionTimeHours = resolutionTimeHours; }

    public String getSuccessRate() { return successRate; }
    public void setSuccessRate(String successRate) { this.successRate = successRate; }

    public String getLessonLearned() { return lessonLearned; }
    public void setLessonLearned(String lessonLearned) { this.lessonLearned = lessonLearned; }

    public String getRecommendedFutureAction() { return recommendedFutureAction; }
    public void setRecommendedFutureAction(String recommendedFutureAction) { this.recommendedFutureAction = recommendedFutureAction; }

    public String getCreatedFromIncident() { return createdFromIncident; }
    public void setCreatedFromIncident(String createdFromIncident) { this.createdFromIncident = createdFromIncident; }

    public String getLastUpdated() { return lastUpdated; }
    public void setLastUpdated(String lastUpdated) { this.lastUpdated = lastUpdated; }

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
