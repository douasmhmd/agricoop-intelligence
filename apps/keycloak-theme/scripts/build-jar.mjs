// Builds the Keycloak theme JAR and drops it where Keycloak loads providers from.
//
//   pnpm keycloak:theme            (repo root)
//
// 1. vite build (the React theme);
// 2. keycloakify build → Keycloak resources + Maven packaging. Keycloakify needs Apache Maven:
//    when `mvn` is not installed, scripts/docker-mvn/ puts a stand-in on PATH that runs the same
//    command in the official maven Docker image (no local Maven/Java setup needed);
// 3. copies dist_keycloak/agricoop-keycloak-theme.jar to apps/keycloak/providers/, mounted into
//    Keycloak by docker-compose.apps.yml (restart Keycloak to load a new build).
import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkg = fileURLToPath(new URL('..', import.meta.url));
const jar = join(pkg, 'dist_keycloak', 'agricoop-keycloak-theme.jar');
const providers = fileURLToPath(new URL('../../keycloak/providers/', import.meta.url));

function hasMaven() {
  try {
    execSync('mvn --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const env = { ...process.env };
if (!hasMaven()) {
  console.warn('Apache Maven not found: packaging with the maven Docker image instead.');
  env.PATH = [join(pkg, 'scripts', 'docker-mvn'), process.env.PATH].join(delimiter);
  // Keep the Maven repository in a Docker volume (the default path would be a host path).
  env.KEYCLOAKIFY_USE_DEFAULT_MAVEN_REPO = 'true';
}

const run = (cmd) => execSync(cmd, { cwd: pkg, env, stdio: 'inherit', shell: true });
run('pnpm exec vite build');
run('pnpm exec keycloakify build');

if (!existsSync(jar)) throw new Error(`Expected ${jar} after keycloakify build`);
mkdirSync(providers, { recursive: true });
copyFileSync(jar, join(providers, 'agricoop-keycloak-theme.jar'));
console.warn(
  `Theme JAR ready: ${join(dirname(providers), 'providers', 'agricoop-keycloak-theme.jar')}`,
);
