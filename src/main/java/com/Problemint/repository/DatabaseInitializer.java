package com.Problemint.repository;

import com.Problemint.model.PreventionRecommendation;
import com.Problemint.model.Complaint;
import com.Problemint.model.Incident;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.stream.Collectors;

public class DatabaseInitializer {

    public static final Map<Integer, Object> DATA_STORE = new ConcurrentHashMap<>();
    private static final List<PreventionRecommendation> PREVENTION_RECOMMENDATIONS = new CopyOnWriteArrayList<>();
    private static final List<?> KNOWLEDGE_ITEMS = new CopyOnWriteArrayList<>();
    private static final Map<String, Complaint> COMPLAINTS = new ConcurrentHashMap<>();
    private static final Map<String, Incident> INCIDENTS = new ConcurrentHashMap<>();
    private static final Map<String, Object> RESOLUTIONS = new ConcurrentHashMap<>();
    private static final List<?> NOTIFICATIONS = new CopyOnWriteArrayList<>();
    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    public static void initialize() {
        try {
            loadCSVData();
            System.out.println("[DB] Database initialized with datasets");
        } catch (IOException e) {
            System.err.println("[DB] Error initializing database: " + e.getMessage());
        }
    }

    private static void loadCSVData() throws IOException {
        String[] files = {"Datasets/PROBLEMINT_complaints_dataset.csv", "Datasets/PROBLEMINT_incidents_dataset.csv"};
        for (String file : files) {
            loadFile(file);
        }
    }

    private static void loadFile(String filePath) throws IOException {
        File file = new File(filePath);
        if (!file.exists()) {
            System.out.println("[DB] Dataset file not found: " + filePath);
            return;
        }

        try (BufferedReader br = new BufferedReader(new InputStreamReader(new FileInputStream(file), StandardCharsets.UTF_8))) {
            String line;
            boolean isHeader = true;
            while ((line = br.readLine()) != null) {
                if (isHeader) {
                    isHeader = false;
                    continue;
                }
                parseAndStore(line);
            }
        }
    }

    private static void parseAndStore(String line) {
        // CSV parsing logic
        String[] parts = line.split(",(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)");
        if (parts.length > 0) {
            DATA_STORE.put(DATA_STORE.size() + 1, parts);
        }
    }

    public static Object getById(int id) {
        return DATA_STORE.get(id);
    }

    public static Collection<Object> getAll() {
        return DATA_STORE.values();
    }

    public static void save(int id, Object data) {
        DATA_STORE.put(id, data);
    }

    public static List<PreventionRecommendation> getPreventionRecommendations() {
        return PREVENTION_RECOMMENDATIONS;
    }

    public static void savePreventionRecommendation(PreventionRecommendation rec) {
        PREVENTION_RECOMMENDATIONS.add(rec);
    }

    public static List<?> getKnowledgeItems() {
        return KNOWLEDGE_ITEMS;
    }

    public static Map<String, Complaint> getComplaints() {
        return COMPLAINTS;
    }

    public static Map<String, Incident> getIncidents() {
        return INCIDENTS;
    }

    public static void saveComplaint(Complaint complaint) {
        if (complaint.getComplaintId() != null) {
            COMPLAINTS.put(complaint.getComplaintId(), complaint);
        }
    }

    public static void saveIncident(Incident incident) {
        if (incident.getIncidentId() != null) {
            INCIDENTS.put(incident.getIncidentId(), incident);
        }
    }

    public static Complaint getComplaintById(int id) {
        return COMPLAINTS.values().stream().filter(c -> c.getId() == id).findFirst().orElse(null);
    }

    public static Incident getIncidentById(int id) {
        return INCIDENTS.values().stream().filter(i -> i.getId() == id).findFirst().orElse(null);
    }

    public static Map<String, Object> getResolutions() {
        return RESOLUTIONS;
    }

    public static List<?> getNotifications() {
        return NOTIFICATIONS;
    }

    public static void saveResolution(Object resolution) {
        String id = "RES-" + RESOLUTIONS.size();
        RESOLUTIONS.put(id, resolution);
    }

    public static void saveNotification(Object notification) {
        // Add notification to list
        if (NOTIFICATIONS instanceof List) {
            ((List<?>) NOTIFICATIONS).add(notification);
        }
    }
}
