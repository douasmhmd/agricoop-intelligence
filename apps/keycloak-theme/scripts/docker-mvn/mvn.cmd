@echo off
rem Stand-in for Apache Maven when it is not installed: runs the same command in the official
rem maven image, in the current folder (Keycloakify's build cache). Used by build-jar.mjs only.
docker run --rm -v "%CD%:/build" -w /build -v agricoop-maven-repo:/root/.m2 maven:3.9-eclipse-temurin-21 mvn %*
