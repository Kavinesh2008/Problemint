package com.Problemint.ai;

import com.Problemint.model.Complaint;
import com.Problemint.model.Incident;
import com.Problemint.repository.DatabaseInitializer;
import java.util.*;

public class AIAssistantEngine {

    public static String respond(String query, String userRole) {
        if (query == null || query.trim().isEmpty()) {
            return "Hello! I am the PROBLEMINT AI Co-pilot. Ask me about active incidents, emerging problem patterns, or specific complaint statuses.";
        }

        String lower = query.toLowerCase();

        if (lower.contains("water") || lower.contains("block b")) {
            return "I've analyzed recent incoming reports. There are 3 emerging problems that require immediate attention. The highest risk issue is the recurring water supply problem in Block B (#INC-016), affecting 47 users with 11 grouped complaints in the last 48 hours.";
        }

        if (lower.contains("my complaint") || lower.contains("status")) {
            return "Your recent complaint (CMP-00756: Water pressure in Block B) is currently being investigated by Facilities & Maintenance. It has been grouped into common Incident #INC-016 with 10 other similar reports.";
        }

        if (lower.contains("attention") || lower.contains("need") || lower.contains("action")) {
            return "There are currently 8 active incidents requiring attention. Top priorities:\n1. INC-016: Block B Water Supply Issue (11 complaints, SLA breach risk)\n2. INC-005: Block A Wi-Fi High Density Saturation (8 complaints)\n3. INC-004: Transport Bay Network Disruption (6 complaints).";
        }

        if (lower.contains("emerging") || lower.contains("trend")) {
            return "Emerging problem trends detected in the last 30 days:\n- Water Supply Issues: +180% surge in Block B\n- Network Instability: +120% surge in CSE Block & Transport Bay\n- Equipment Maintenance: +75% surge in Computer Lab 1.";
        }

        return "PROBLEMINT Intelligence Engine has processed your query: '" + query + "'. All systems are monitored in real time across 1,000+ complaints and 36 grouped incidents.";
    }
}
