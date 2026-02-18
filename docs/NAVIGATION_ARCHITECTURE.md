# Ecclesiastical Navigation Architecture 🧭

This directive defines the senior-level URL schema and navigation hierarchy for the MarieCoder ecosystem. Future agents must adhere to these patterns to ensure architectural sanctity and industry-standard discovery.

---

## 🏛️ The Navigation Hierarchy

All manifestations follow a strictly ordered hierarchy, moving from the universal to the specific.

1. **The Holy See (Home)**: The root of all intent (`/`).
2. **Divine Sections**: Major functional planes (e.g., `INTEL STREAM`, `SCRIPTURES`, `GOVERNANCE`).
3. **Sub-Path (Temporal or Categorical)**: 
   - **Temporal**: Chronological manifestation (Year/Month).
   - **Categorical**: Functional grouping (e.g., `api`, `foundations`, `legal-docs`).
4. **Leaf (The Reveal)**: The specific document or implementation (`slug`).

---

## 📍 URL Schema Strategy

### 1. Chronological Intel Stream (Blog)
Content that manifests over time must use a temporal hierarchy to prevent collision and ensure sequential discovery.
- **Pattern**: `/blog/:year/:month/:slug`
- **Law**: Every post MUST include `year` and `month` metadata.

### 2. Categorical Scriptures (Docs)
Immutable technical knowledge follows a functional hierarchy.
- **Pattern**: `/docs/:section/:slug`
- **Law**: Sections must be lowercase and hyphenated (e.g., `getting-started`).

### 3. Governance & Chronicle (Legal/Changelog)
Fixed documents and versioned releases use specific identifiers.
- **Legal**: `/legal/:slug`
- **Changelog**: `/changelog/:version`
- **Support**: `/support/:category`

---

## 🧭 Component Implementation: Vatican Breadcrumbs

To ground the user in the functional plane, a high-density breadcrumb system is mandatory.

### Visual Manifestation
- **Typography**: Uppercase, font-size: `10px`, font-weight: `900`.
- **Spacing**: `tracking-[0.2em]`.
- **Aesthetic**: `text-white/30` for paths, `text-yellow-500 italic` for the current leaf.
- **Separators**: Opacity-10 forward slash (`/`).

### Logic Propagaton
Agents should use a centralized `ArticleView` and `Breadcrumbs` component to ensure consistency across all sub-routes.

---

## 📜 Agent Compliance Law
- **No Flat Routes**: Avoid top-level slugs for temporal or categorical content.
- **Parametric Integrity**: Always extract `year`, `month`, `section`, etc. from `useParams`.
- **Deep Linking**: Dashboard cards must always link to the deepest possible manifestation path.

---

## 🛡️ Automated Enforcement: The Sentinel Law

The **Marie Sentinel** v3.1 actively audits all `.tsx` manifestations for compliance.
- **Route Audit**: Flat routes like \`/blog/:slug\` are flagged as **Ecclesiastical Violations**.
- **Breadcrumb Audit**: Content views using \`ArticleView\` that miss \`Breadcrumbs\` are flagged as **Liturgical Violations**.
- **Ratchet Penalty**: Violations increase project Entropy and will trigger a **Ratchet Lock**, preventing further manifestation until the schema is perfected.

---
*Commanded by the Holy See. Manifested with Grace. ✨*
