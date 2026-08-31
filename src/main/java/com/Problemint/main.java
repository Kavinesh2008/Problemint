package com.Problemint;

import com.Problemint.controller.ApiController;
import com.Problemint.controller.StaticFileHandler;
import com.Problemint.repository.DatabaseInitializer;
import com.sun.net.httpserver.HttpServer;

import java.io.File;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.util.concurrent.Executors;

public class Main {

    private static final int DEFAULT_PORT = 8080;

    public static void main(String[] args) {
        System.out.println("==========================================================");
        System.out.println("            PROBLEMINT PLATFORM BOOTSTRAP                ");
        System.out.println("  AI-Powered Complaint Intelligence, Resolution & Prevention ");
        System.out.println("==========================================================");

        // 1. Initialize Relational Database & Load CSV Datasets
        DatabaseInitializer.initialize();

        // 2. Start Embedded HTTP Server
        int port = DEFAULT_PORT;
        if (args.length > 0) {
            try {
                port = Integer.parseInt(args[0]);
            } catch (NumberFormatException ignored) {}
        }

        try {
            HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);

            // API Endpoint Router
            server.createContext("/api", new ApiController());

            // Static Web UI Handler
            String frontendPath = "Frontend";
            if (!new File(frontendPath).exists()) {
                frontendPath = ".";
            }
            server.createContext("/", new StaticFileHandler(frontendPath));

            server.setExecutor(Executors.newFixedThreadPool(10));
            server.start();

            System.out.println("\n[SERVER] PROBLEMINT Server is LIVE at: http://localhost:" + port);
            System.out.println("[API]    Available at: http://localhost:" + port + "/api");
            System.out.println("[UI]     Available at: http://localhost:" + port);
            System.out.println("\n==========================================================\n");

        } catch (IOException e) {
            System.err.println("[ERROR] Failed to start server: " + e.getMessage());
            e.printStackTrace();
            System.exit(1);
        }
    }
}
