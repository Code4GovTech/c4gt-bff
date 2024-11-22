# Document: What is PDF/A and Why We’re Converting Certificates to PDF/A

## What is PDF/A?

PDF/A is an ISO-standardized version of the Portable Document Format (PDF) designed for long-term archiving and preservation of electronic documents. Unlike regular PDFs, which can include dynamic content or dependencies on external resources, PDF/A ensures that the document remains self-contained and consistent over time. 

### Key Features of PDF/A:
1. **Self-Containment:**
   - All fonts used in the document must be embedded, ensuring consistent rendering across different devices and software.
   - External resources such as links or embedded scripts are prohibited.

2. **Device Independence:**
   - Color spaces are defined explicitly, eliminating reliance on device-specific settings.

### Why is PDF/A Important?

PDF/A is particularly valuable for scenarios that require document consistency and reliability, such as:
- Legal documents
- Archival records
- Certificates and compliance documents
- Financial records

It ensures that documents remain accessible and render identically regardless of the software or hardware used in the future.

---

## Why We’re Converting Certificates to PDF/A

### The Problem:
**Inconsistent Rendering Across Platforms:**
   - As seen in this [issue](https://github.com/Code4GovTech/c4gt-bff/issues/2), certificates created in a standard PDF format can render differently on various software platforms (e.g., Apple Preview vs. Google Chrome). These discrepancies undermine the credibility and usability of the certificates.

### The Solution:
By converting certificates to the PDF/A format, we address these issues and ensure that the certificates render consistently across platforms and devices.

---

## Implementation: Using Ghostscript for PDF/A Conversion

To achieve PDF/A compliance, we’re utilizing **[Ghostscript](https://ghostscript.readthedocs.io/en/latest/Use.html)**, a robust command-line tool for PDF manipulation.
