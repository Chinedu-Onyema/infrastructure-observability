'use strict';

const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');       // replaces JaegerExporter
const { registerInstrumentations } = require('@opentelemetry/instrumentation');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');
const { SimpleSpanProcessor } = require('@opentelemetry/sdk-trace-base');
const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http');
const { ExpressInstrumentation } = require('@opentelemetry/instrumentation-express');

// Service name comes from the env var, falling back to service-b for this app
const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || 'service-b';

// Jaeger v2 receives OTLP/HTTP on port 4318 (Service "jaeger" in namespace "tracing")
const OTLP_ENDPOINT =
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://jaeger.tracing.svc.cluster.local:4318';

// Initialize the provider
const provider = new NodeTracerProvider({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: SERVICE_NAME,
  }),
});

// Setup the exporter (when url is set explicitly, the /v1/traces path is required)
const exporter = new OTLPTraceExporter({
  url: `${OTLP_ENDPOINT.replace(/\/$/, '')}/v1/traces`,
});

// Add the exporter to the provider
provider.addSpanProcessor(new SimpleSpanProcessor(exporter));

// Initialize the provider and instrumentations
provider.register();

registerInstrumentations({
  instrumentations: [
    new HttpInstrumentation({
      applyCustomAttributesOnSpan: (span, request, response) => {
        span.setAttribute('custom-attribute', 'custom-value');
      },
    }),
    new ExpressInstrumentation(),
  ],
});

console.log(`Tracing initialized for ${SERVICE_NAME}, exporting to ${OTLP_ENDPOINT}`);