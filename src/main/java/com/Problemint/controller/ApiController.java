package com.Problemint.controller;

import com.Problemint.ai.*;
import com.Problemint.model.*;
import com.Problemint.repository.DatabaseInitializer;
import com.Problemint.util.SimpleJson;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

public class ApiController implements HttpHandler {

    @Override
    public void handle(HttpExchange exchange) throws IOException {
        String path = exchange.getRequestURI().getPath();
        String method = exchange.getRequestMethod();

        // Enable CORS
        exchange.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
        exchange.getResponseHeaders().add("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        exchange.getResponseHeaders().add("Access-Control-Allow-Headers", "Content-Type, Authorization");

        if ("OPTIONS".equalsIgnoreCase(method)) {
            exchange.sendResponseHeaders(204, -1);
            return;
        }

        try {
            if (path.equals("/api/dashboard/stats") && "GET".equalsIgnoreCase(method)) {
                handleDashboardStats(exchange);
            } else if (path.equals("/api/complaints/analyze") && "POST".equalsIgnoreCase(method)) {
                handleComplaintAnalyze(exchange);
            } else if (path.equals("/api/complaints/clarify") && "POST".equalsIgnoreCase(method)) {
                handleComplaintClarify(exchange);
            } else if (path.equals("/api/complaints/pre-resolution") && "POST".equalsIgnoreCase(method)) {
                handleComplaintPreResolution(exchange);
            } else if (path.equals("/api/complaints/similar") && "POST".equalsIgnoreCase(method)) {
                handleComplaintSimilar(exchange);
            } else if (path.equals("/api/complaints") && "GET".equalsIgnoreCase(method)) {
                handleGetComplaints(exchange);
            } else if (path.equals("/api/complaints") && "POST".equalsIgnoreCase(method)) {
                handleCreateComplaint(exchange);
            } else if (path.startsWith("/api/complaints/") && "GET".equalsIgnoreCase(method)) {
                String id = path.substring("/api/complaints/".length());
                handleGetComplaintById(exchange, id);
            } else if (path.equals("/api/incidents") && "GET".equalsIgnoreCase(method)) {
                handleGetIncidents(exchange);
            } else if (path.startsWith("/api/incidents/") && path.endsWith("/root-cause") && "GET".equalsIgnoreCase(method)) {
                String id = path.substring("/api/incidents/".length(), path.indexOf("/root-cause"));
                handleGetIncidentRootCause(exchange, id);
            } else if (path.startsWith("/api/incidents/") && "GET".equalsIgnoreCase(method)) {
                String id = path.substring("/api/incidents/".length());
                handleGetIncidentById(exchange, id);
            } else if (path.equals("/api/resolutions") && "GET".equalsIgnoreCase(method)) {
                handleGetResolutions(exchange);
            } else if (path.equals("/api/resolutions") && "POST".equalsIgnoreCase(method)) {
                handleCreateResolution(exchange);
            } else if (path.equals("/api/verification") && "POST".equalsIgnoreCase(method)) {
                handleUserVerification(exchange);
            } else if (path.equals("/api/knowledge") && "GET".equalsIgnoreCase(method)) {
                handleGetKnowledge(exchange);
            } else if (path.equals("/api/prevention") && "GET".equalsIgnoreCase(method)) {
                handleGetPrevention(exchange);
            } else if (path.equals("/api/analytics") && "GET".equalsIgnoreCase(method)) {
                handleGetAnalytics(exchange);
            } else if (path.equals("/api/copilot") && "POST".equalsIgnoreCase(method)) {
                handleCopilot(exchange);
            } else if (path.equals("/api/notifications") && "GET".equalsIgnoreCase(method)) {
                handleGetNotifications(exchange);
            } else {
                sendJsonResponse(exchange, 404, Map.of("error", "Endpoint not found: " + path));
            }
        } catch (Exception e) {
            System.err.println("[API ERROR] " + e.getMessage());
            e.printStackTrace();
            sendJsonResponse(exchange, 500, Map.of("error", "Internal Server Error: " + e.getMessage()));
        }
    }

    private void handleDashboardStats(HttpExchange exchange) throws IOException {
        Map<String, Object> res = new HashMap<>();
        res.put("totalReports", DatabaseInitializer.getComplaints().size());
        res.put("activeProblems", (int) DatabaseInitializer.getIncidents().values().stream().filter(i -> !"Resolved".equalsIgnoreCase(i.getStatus())).count());
        res.put("emergingIssues", 8);
        res.put("recurringProblems", 12);
        res.put("aiConfidence", "94%");

        List<Map<String, Object>> attentionList = new ArrayList<>();
        Map<String, Object> item1 = new HashMap<>();
        item1.put("type", "CRITICAL EMERGING");
        item1.put("title", "Water Supply");
        item1.put("location", "Block B · Multiple reports in last 2hrs");
        item1.put("tags", Arrays.asList("Plumbing", "Urgent SLA"));
        item1.put("incidentId", "INC-016");
        attentionList.add(item1);

        Map<String, Object> item2 = new HashMap<>();
        item2.put("type", "RECURRING ISSUE");
        item2.put("title", "Network Instability");
        item2.put("location", "Block C · 4th occurrence this month");
        item2.put("tags", Arrays.asList("IT Infrastructure"));
        item2.put("incidentId", "INC-005");
        attentionList.add(item2);

        Map<String, Object> item3 = new HashMap<>();
        item3.put("type", "PREVENTIVE REC");
        item3.put("title", "Pump Inspection");
        item3.put("location", "Block B · AI suggested based on wear pattern");
        item3.put("tags", Arrays.asList("Maintenance"));
        item3.put("recId", "REC-00010");
        attentionList.add(item3);

        res.put("needsAttention", attentionList);
        sendJsonResponse(exchange, 200, res);
    }

    private void handleComplaintAnalyze(HttpExchange exchange) throws IOException {
        Map<String, Object> body = parseRequestBody(exchange);
        String text = (String) body.get("text");
        ComplaintUnderstandingEngine.AnalysisResult result = ComplaintUnderstandingEngine.analyze(text);
        sendJsonResponse(exchange, 200, result);
    }

    private void handleComplaintClarify(HttpExchange exchange) throws IOException {
        Map<String, Object> body = parseRequestBody(exchange);
        String text = (String) body.get("text");
        List<AIClarificationEngine.Question> questions = AIClarificationEngine.generateClarificationQuestions(text);
        sendJsonResponse(exchange, 200, Map.of("questions", questions));
    }

    private void handleComplaintPreResolution(HttpExchange exchange) throws IOException {
        Map<String, Object> body = parseRequestBody(exchange);
        String category = (String) body.get("category");
        String location = (String) body.get("location");
        PreResolutionEngine.PreResolutionRecommendation suggestions = PreResolutionEngine.getSuggestions(category, location);
        sendJsonResponse(exchange, 200, suggestions);
    }

    private void handleComplaintSimilar(HttpExchange exchange) throws IOException {
        Map<String, Object> body = parseRequestBody(exchange);
        String text = (String) body.get("text");
        String category = (String) body.get("category");
        String location = (String) body.get("location");
        List<RelatedComplaintEngine.SimilarityResult> similar = RelatedComplaintEngine.findSimilarComplaints(text, category, location);
        sendJsonResponse(exchange, 200, Map.of("similarComplaints", similar));
    }

    private void handleGetComplaints(HttpExchange exchange) throws IOException {
        List<Complaint> list = new ArrayList<>(DatabaseInitializer.getComplaints().values());
        list.sort((a, b) -> String.valueOf(b.getCreatedAt()).compareTo(String.valueOf(a.getCreatedAt())));
        sendJsonResponse(exchange, 200, list);
    }

    private void handleCreateComplaint(HttpExchange exchange) throws IOException {
        Map<String, Object> body = parseRequestBody(exchange);
        Complaint c = new Complaint();
        c.setComplaintId("CMP-" + String.format("%05d", DatabaseInitializer.getComplaints().size() + 1));
        c.setComplaintText((String) body.getOrDefault("complaintText", ""));
        c.setCategory((String) body.getOrDefault("category", "General"));
        c.setSubcategory((String) body.getOrDefault("subcategory", "Maintenance"));
        c.setLocation((String) body.getOrDefault("location", "Main Campus"));
        c.setDepartment((String) body.getOrDefault("department", "Facilities"));
        c.setSeverity((String) body.getOrDefault("severity", "Medium"));
        c.setImpact((String) body.getOrDefault("impact", "Multiple Users"));
        c.setStatus("Investigating");
        c.setIncidentId((String) body.getOrDefault("incidentId", "INC-016"));
        c.setSource((String) body.getOrDefault("source", "Web"));
        c.setCreatedAt(LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")));
        c.setUserId("USR-001");
        c.setHasEvidence(true);

        DatabaseInitializer.saveComplaint(c);
        sendJsonResponse(exchange, 201, Map.of("message", "Complaint created successfully", "complaint", c));
    }

    private void handleGetComplaintById(HttpExchange exchange, String id) throws IOException {
        Complaint c = DatabaseInitializer.getComplaints().get(id);
        if (c == null) {
            sendJsonResponse(exchange, 404, Map.of("error", "Complaint not found"));
        } else {
            sendJsonResponse(exchange, 200, c);
        }
    }

    private void handleGetIncidents(HttpExchange exchange) throws IOException {
        List<Incident> list = new ArrayList<>(DatabaseInitializer.getIncidents().values());
        list.sort((a, b) -> String.valueOf(b.getLastReportedAt()).compareTo(String.valueOf(a.getFirstReportedAt())));
        sendJsonResponse(exchange, 200, list);
    }

    private void handleGetIncidentById(HttpExchange exchange, String id) throws IOException {
        Incident inc = DatabaseInitializer.getIncidents().get(id);
        if (inc == null) {
            sendJsonResponse(exchange, 404, Map.of("error", "Incident not found"));
            return;
        }

        List<Complaint> grouped = DatabaseInitializer.getComplaints().values().stream()
                .filter(c -> id.equalsIgnoreCase(c.getIncidentId()))
                .collect(Collectors.toList());

        Map<String, Object> res = new HashMap<>();
        res.put("incident", inc);
        res.put("groupedComplaints", grouped);
        res.put("rootCauseHypothesis", RootCauseAnalysisEngine.analyzeRootCause(inc));
        sendJsonResponse(exchange, 200, res);
    }

    private void handleGetIncidentRootCause(HttpExchange exchange, String id) throws IOException {
        Incident inc = DatabaseInitializer.getIncidents().get(id);
        if (inc == null) {
            sendJsonResponse(exchange, 404, Map.of("error", "Incident not found"));
        } else {
            RootCauseAnalysisEngine.RootCauseHypothesis h = RootCauseAnalysisEngine.analyzeRootCause(inc);
            sendJsonResponse(exchange, 200, h);
        }
    }

    private void handleGetResolutions(HttpExchange exchange) throws IOException {
        List<Resolution> list = new ArrayList<>(DatabaseInitializer.getResolutions().values());
        sendJsonResponse(exchange, 200, list);
    }

    private void handleCreateResolution(HttpExchange exchange) throws IOException {
        Map<String, Object> body = parseRequestBody(exchange);
        String incidentId = (String) body.get("incidentId");
        String actionTaken = (String) body.get("actionTaken");
        String actionType = (String) body.getOrDefault("actionType", "Replacement");

        FailedSolutionLearningEngine.FailedSolutionWarning warning =
                FailedSolutionLearningEngine.evaluateAction(incidentId, actionTaken, actionType);

        if (warning.isBlocked) {
            sendJsonResponse(exchange, 400, Map.of(
                    "status", "BLOCKED",
                    "error", warning.warningMessage,
                    "historicallyFailedSolution", warning.historicallyFailedSolution,
                    "recommendedAlternative", warning.recommendedAlternative
            ));
            return;
        }

        Resolution res = new Resolution();
        res.setResolutionId("RES-" + String.format("%05d", DatabaseInitializer.getResolutions().size() + 1));
        res.setIncidentId(incidentId);
        res.setAttemptNumber(2);
        res.setActionTaken(actionTaken);
        res.setPerformedBy((String) body.getOrDefault("performedBy", "Facilities Ops Team"));
        res.setActionType(actionType);
        res.setOutcome("Successful");
        res.setSuccess(true);
        res.setResolutionTimeHours(4.0);
        res.setPerformedAt(LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));

        DatabaseInitializer.saveResolution(res);

        Incident inc = DatabaseInitializer.getIncidents().get(incidentId);
        if (inc != null) {
            inc.setStatus("Resolved");
            inc.setResolutionStatus("Completed");
            OrganizationalMemoryEngine.storeMemory(inc, res, "Soft rebooting / temporary patch", "Permanent component replacement fixes hardware failures.");
            PreventionEngine.generateRecommendation(inc);
        }

        sendJsonResponse(exchange, 201, Map.of("message", "Resolution attempt recorded successfully", "resolution", res));
    }

    private void handleUserVerification(HttpExchange exchange) throws IOException {
        Map<String, Object> body = parseRequestBody(exchange);
        String complaintId = (String) body.get("complaintId");
        String verificationStatus = (String) body.get("verificationStatus");
        String feedbackText = (String) body.get("feedbackText");

        Complaint c = DatabaseInitializer.getComplaints().get(complaintId);
        if (c != null) {
            if ("Yes".equalsIgnoreCase(verificationStatus)) {
                c.setUserVerified(true);
                c.setStatus("Closed");
            } else {
                c.setUserVerified(false);
                c.setStatus("Investigating");
                DatabaseInitializer.saveNotification(new Notification(
                        "NOTIF-" + System.currentTimeMillis(), "USR-001", "DISPUTE_ALERT",
                        "User Verification Dispute", "User reported problem continues for " + complaintId + ": " + feedbackText,
                        "#complaints/" + complaintId, LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm"))
                ));
            }
        }

        sendJsonResponse(exchange, 200, Map.of("message", "User verification recorded successfully"));
    }

    private void handleGetKnowledge(HttpExchange exchange) throws IOException {
        List<KnowledgeItem> list = new ArrayList<>(DatabaseInitializer.getKnowledgeItems().values());
        sendJsonResponse(exchange, 200, list);
    }

    private void handleGetPrevention(HttpExchange exchange) throws IOException {
        List<PreventionRecommendation> list = new ArrayList<>(DatabaseInitializer.getPreventionRecommendations().values());
        sendJsonResponse(exchange, 200, list);
    }

    private void handleGetAnalytics(HttpExchange exchange) throws IOException {
        Map<String, Object> res = new HashMap<>();
        res.put("resolutionVerificationRate", "72%");
        res.put("avgResolutionTimeHours", 14.5);
        res.put("openCriticalIncidents", 8);
        res.put("totalActiveTickets", 1200);

        Map<String, Integer> categoryDistribution = new HashMap<>();
        categoryDistribution.put("Facilities & Plumbing", 42);
        categoryDistribution.put("Internet & Network", 30);
        categoryDistribution.put("Electrical & Power", 18);
        categoryDistribution.put("Housekeeping & General", 10);
        res.put("categoryDistribution", categoryDistribution);

        sendJsonResponse(exchange, 200, res);
    }

    private void handleCopilot(HttpExchange exchange) throws IOException {
        Map<String, Object> body = parseRequestBody(exchange);
        String query = (String) body.get("query");
        String role = (String) body.getOrDefault("role", "Admin");
        String answer = AIAssistantEngine.respond(query, role);
        sendJsonResponse(exchange, 200, Map.of("response", answer));
    }

    private void handleGetNotifications(HttpExchange exchange) throws IOException {
        List<Notification> list = new ArrayList<>(DatabaseInitializer.getNotifications().values());
        sendJsonResponse(exchange, 200, list);
    }

    private Map<String, Object> parseRequestBody(HttpExchange exchange) throws IOException {
        InputStream is = exchange.getRequestBody();
        String json = new String(is.readAllBytes(), StandardCharsets.UTF_8);
        return SimpleJson.parseMap(json);
    }

    private void sendJsonResponse(HttpExchange exchange, int statusCode, Object data) throws IOException {
        byte[] responseBytes = SimpleJson.toJson(data).getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=UTF-8");
        exchange.sendResponseHeaders(statusCode, responseBytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(responseBytes);
        }
    }
}
