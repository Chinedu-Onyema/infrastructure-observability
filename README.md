# Comprehensive Guide to Node.js Application Instrumentation with Prometheus
This repository contains a practical guide and the necessary source code to instrument a Node.js application for deep observability. 

The project demonstrates how to expose application-level metrics (Counters, Histograms, Gauges, Summaries) to Prometheus and configure Alertmanager to send email notifications based on application health.

#### PDF GUIDE: [INSTRUMENTATION GUIDE FOR NODE APPLICATION.pdf](https://github.com/user-attachments/files/33024674/INSTRUMENTATION.GUIDE.FOR.NODE.APPLICATION.pdf)

#### WATCH VIDEO WALKTHROUGH HERE: https://youtu.be/VjlyjRydOSs

Note: This guide assumes you have already installed the Prometheus Operator stack in your Kubernetes cluster (specifically in the monitoring namespace), as covered in previous foundational lessons.


## PREQUISITE
Before beginning, ensure you have the following installed and running:

Docker Desktop (Required to run Minikube).
Minikube (For a local Kubernetes cluster).
kubectl (Kubernetes command-line tool).
helm (For managing Kubernetes packages).
Git.


## PROJECT STRUCTURE

application/service-a/: A Node.js application containing implemented instrumentation (prom-client) and multiple API endpoints.

application/service-b/: A complementary Node.js microservice.

kubernetes-manifest/: Kustomize base for deploying Service A and Service B.

alerts-alertmanager-servicemonitor-manifest/: Kustomize base for deploying Prometheus ServiceMonitor, Alertmanager configuration, and email secrets.


## SETUP STEPS
Follow these steps sequentially to set up the environment, deploy the application, and configure alerting.

### Step 1: Clone the Repository

Clone this repository to your local machine to access the application code and Kubernetes manifests.

<PRE>git clone https://github.com/Chinedu-Onyema/infrastructure-observability.git</PRE>
<PRE>cd infrastructure-observability</PRE>
<PRE>cd instrumenting-metrics</PRE>


### Step 2: Start Minikube and Configure Docker Environment

Launch Minikube and point your local Docker CLI to the Minikube Docker daemon. 
This allows Kubernetes to pull the images you build locally without pushing them to a public registry.

#### Start Minikube
<PRE>minikube start</PRE>

#### Point terminal to Minikube's Docker daemon
#### (Run this command in every new terminal session intended for building images)
<PRE>eval $(minikube docker-env)</PRE>

<PRE>minikube status</PRE>


### Step 3: Build Node.js Application Images

Ensure you are in the instrumenting-metrics directory. 
Build the Docker images for service-a and service-b inside the Minikube environment.

#### Build Image for Service A
<PRE>docker build -t node-app-service-a:latest application/service-a/</PRE>

#### Build Image for Service B
<PRE>docker build -t node-app-service-b:latest application/service-b/</PRE>

#### Verify images are built and available to Minikube
<PRE>docker images</PRE>


### Step 4: Deploy the Application to Kubernetes

1) Create a dedicated namespace for the application.

   <PRE>kubectl create ns dev</PRE>

2) Apply the Kubernetes manifests using Kustomize to deploy the services and deployments in the dev namespace.

   <PRE>kubectl apply -k kubernetes-manifest/</PRE>

3) Verify the deployment:

   <PRE>kubectl get deploy -n dev</PRE>

   #### Ensure pods are running
   <PRE>kubectl get pods -n dev</PRE>
   
   #### Ensure services are created (NodePort for service-a)
   <PRE>kubectl get svc -n dev</PRE>

4) Access Service A in your web browser via Minikube tunnel:

   <PRE>minikube service a-service -n dev</PRE>

   While the app is running, test various endpoints, specifically /metrics to see the raw instrumented data, and /call-service-b to test inter-service communication.


### Step 5: Enable Prometheus Service Discovery

To allow Prometheus to scrape metrics from your Node.js application, you must deploy a ServiceMonitor. 
This resource tells the Prometheus Operator to look for services with specific labels in the dev namespace.

1) Apply the ServiceMonitor manifest (ensure your existing Prometheus is installed in the monitoring namespace).

   <PRE>kubectl apply -k alerts-alertmanager-servicemonitor-manifest/</PRE>
   (Note: You may safely ignore errors regarding alertmanagerconfig.yml on the first apply if the CRDs are not yet established).

2) Verify the ServiceMonitor

   <PRE>kubectl get servicemonitor -n monitoring</PRE>

3) Verify Metrics in Prometheus:
   Access the Prometheus UI.
   ensure port-forwarding is active from previous setups, e.g.,
   <PRE>kubectl port-forward service/prometheus-operated -n monitoring 9090:9090</PRE.
   Go to [http://127.0.0.1:9090](http://127.0.0.1:9090).

   In the expression bar, search for a metric exposed by the app, such as http_requests_total.
   Prometheus should now be able to query data from the Node.js application.


### Step 6: Configure Alertmanager with Gmail

Configure Alertmanager to send email notifications when application pods crash.

1) Generate a Gmail App Password:
   Go to your Google Account settings.
   Navigate to Security -> 2-Step Verification must be enabled.
   At the bottom of the Security page, select App passwords.
   Create a new app named prom-alerts. Copy the generated 16-character password.

2) Encode the Password to Base64:
   In your terminal, encode the password (including spaces, though the command will handle it properly if quoted).

   <PRE>#### Example: echo "abcd efgh ijkl mnop" | base64</PRE>
   <PRE>echo "your-16-digit-app-password" | base64</PRE>

3) Update Kubernetes Secrets:
   Edit the alerts-alertmanager-servicemonitor-manifest/email-secrets.yml file.
   Replace the placeholder with your Base64 encoded password.

   #### ... inside email-secrets.yml
```
   data:
     gmail-pass: <YOUR_BASE64_ENCODED_PASSWORD_HERE>
```

4) Update Alertmanager Config:
   Edit alerts-alertmanager-servicemonitor-manifest/alertmangerconfig.yml.
   Replace all instances of YOUR_EMAIL_ID with your actual Gmail address.

5) Apply the Alerting Manifests:
   Apply the updated secrets and configuration.

   <PRE>kubectl apply -k alerts-alertmanager-servicemonitor-manifest/</PRE>


### Step 7: Test Alerting

1) Crash the Application:
   Access your Node.js application via Minikube Service (Step 4) and add the /crash endpoint to the URL (e.g., [http://127.0.0.1](http://127.0.0.1):<port>/crash).
   This will terminate the Node.js process.

2) Observe Kubernetes Self-Healing:
   Kubernetes will detect the failed container and restart it.
   Check pod restarts:

   <PRE>kubectl get pods -n dev --watch</PRE>

3) Receive Email Alert:
   Check the inbox of the email address configured in alertmangerconfig.yml.
   You should receive an alert indicating that the ServiceACrashLooping has fired.


## UUNDERSTANDING THE INSTRUMENTATION (CODE OVERVIEW)

Review application/service-a/index.js to understand how metrics are implemented using prom-client:

Default Metrics: The app is configured to collect default Node.js metrics (CPU, memory, GC).

Counter (http_requests_total): Increments every time an HTTP request is received. Labeled by method, path, and status_code.

Histogram (http_request_duration_seconds): Measures the duration of HTTP requests, placing them into defined buckets (e.g., 0.1s, 1s, 10s) to calculate Apdex scores and quantiles.

Gauge (node_gauge_example): Used here to simulate memory usage that can go up and down arbitrarily.

Summary (http_response_size_bytes): Similar to histogram, calculates specific quantiles (e.g., 50th, 90th, 99th percentile) of response size


