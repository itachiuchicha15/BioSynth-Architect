import time
import base64
from typing import List, Dict, Any, Optional
from cerebras.cloud.sdk import Cerebras
from app.config import CEREBRAS_API_KEY, MODEL_NAME


class CerebrasService:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or CEREBRAS_API_KEY
        self._client = None

    @property
    def client(self) -> Cerebras:
        if not self._client:
            if not self.api_key:
                raise ValueError("Cerebras API Key is not set. Please provide it in configuration.")
            self._client = Cerebras(api_key=self.api_key)
        return self._client

    # ── Utility: read image as base64 ─────────────────────────────────────────
    @staticmethod
    def _img_to_b64(path: str) -> str:
        with open(path, "rb") as f:
            return base64.b64encode(f.read()).decode("utf-8")

    @staticmethod
    def _img_content(b64: str, mime: str = "image/png") -> Dict[str, Any]:
        return {
            "type": "image_url",
            "image_url": {"url": f"data:{mime};base64,{b64}"}
        }

    # ── Core chat completion ───────────────────────────────────────────────────
    def chat_completion(
        self,
        messages: List[Dict[str, Any]],
        model: str = MODEL_NAME,
        reasoning_effort: str = "none",
        temperature: float = 0.2,
    ) -> Dict[str, Any]:
        """
        Performs chat completion and measures exact latencies.
        """
        start_time = time.perf_counter()

        params: Dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
        }
        if reasoning_effort != "none":
            params["reasoning_effort"] = reasoning_effort

        try:
            response = self.client.chat.completions.create(**params)
            end_time = time.perf_counter()
            total_latency = end_time - start_time

            time_info = getattr(response, "time_info", {})
            usage = getattr(response, "usage", None)

            prompt_tokens     = usage.prompt_tokens     if usage else 0
            completion_tokens = usage.completion_tokens if usage else 0
            total_tokens      = usage.total_tokens      if usage else 0

            tokens_per_sec = (
                completion_tokens / total_latency
                if total_latency > 0 and completion_tokens > 0
                else 0
            )

            ttft = getattr(time_info, "queue_time", 0.05) + getattr(time_info, "init_time", 0.05)
            if hasattr(time_info, "time_to_first_token"):
                ttft = time_info.time_to_first_token

            return {
                "content": response.choices[0].message.content,
                "usage": {
                    "prompt_tokens":     prompt_tokens,
                    "completion_tokens": completion_tokens,
                    "total_tokens":      total_tokens,
                },
                "metrics": {
                    "total_latency_sec": round(total_latency, 3),
                    "ttft_sec":          round(ttft, 3),
                    "tokens_per_sec":    round(tokens_per_sec, 2),
                    "is_cerebras":       True,
                },
            }
        except Exception as e:
            raise RuntimeError(f"Cerebras API Completion failed: {str(e)}")

    # ── Enhancement 1: Interleaved 3-Image Assessor ───────────────────────────
    def assess_mutant_multimodal(
        self,
        wildtype_img_path: str,
        mutant_img_path: str,
        mutation_description: str,
        full_protein_img_path: Optional[str] = None,
        reasoning_effort: str = "high",
    ) -> Dict[str, Any]:
        """
        Sends interleaved text+image messages to Gemma 4 for visual steric clash
        and pocket-shape evaluation. Uses up to 3 images with captions woven
        between each image for guided multimodal attention.

        Gemma 4 31B supports up to 5 images per request via Cerebras.
        We interleave text descriptions between images so the model processes
        each image in context rather than receiving a flat dump of images.
        """
        try:
            wt_b64  = self._img_to_b64(wildtype_img_path)
            mut_b64 = self._img_to_b64(mutant_img_path)
            full_b64 = self._img_to_b64(full_protein_img_path) if full_protein_img_path else None
        except Exception as e:
            raise IOError(f"Failed to read image files for multimodal evaluation: {str(e)}")

        # ── Interleaved prompt: text caption → image → text caption → image → ... ──
        # This guides Gemma 4's visual attention frame-by-frame, which is more
        # powerful than a single text block followed by a flat list of images.
        content: List[Dict[str, Any]] = [
            {
                "type": "text",
                "text": (
                    f"You are the Multimodal Protein Assessor Agent for BioSynth Architect. "
                    f"You have been given {3 if full_b64 else 2} scientific renders from PyMOL for the mutation:\n"
                    f"  {mutation_description}\n\n"
                    f"Examine each image carefully as it is presented. I will guide you through them.\n\n"
                    f"── IMAGE 1: Wild-Type Binding Pocket ──\n"
                    f"This is the native wild-type residue at the mutation site, shown as sticks (green carbons). "
                    f"Yellow dashed lines indicate hydrogen bonds (polar contacts ≤3.5 Å) to neighboring residues (cyan carbons)."
                )
            },
            self._img_content(wt_b64),
            {
                "type": "text",
                "text": (
                    f"── IMAGE 2: Mutant Binding Pocket ──\n"
                    f"This is the same site AFTER in-silico mutagenesis ({mutation_description}). "
                    f"The mutant residue is shown in magenta carbons. "
                    f"Compare the pocket geometry, side-chain size, and hydrogen bond network to Image 1."
                )
            },
            self._img_content(mut_b64),
        ]

        if full_b64:
            content.append({
                "type": "text",
                "text": (
                    f"── IMAGE 3: Full Mutant Protein — Global Structure Context ──\n"
                    f"This is the complete protein ribbon diagram after mutagenesis. "
                    f"Helices are salmon, beta-sheets are pale green, loops are wheat. "
                    f"The mutation site is highlighted. "
                    f"Assess whether the local mutation perturbs any major secondary structure element or domain."
                )
            })
            content.append(self._img_content(full_b64))

        content.append({
            "type": "text",
            "text": (
                f"── Analysis Tasks ──\n"
                f"Based on all {3 if full_b64 else 2} images above, provide a detailed structural assessment:\n"
                f"1. **Steric Clash Analysis**: Does the mutant residue introduce a larger side chain "
                f"that crowds or clashes with neighboring backbone or side-chain atoms?\n"
                f"2. **Hydrogen Bond Network Changes**: How has the polar contact network changed "
                f"between Images 1 and 2? Are bonds gained, lost, or shifted?\n"
                f"3. **Pocket/Cavity Shape**: Has the binding pocket become more open, closed, "
                f"or distorted? What impact would this have on small-molecule inhibitor binding?\n"
                f"4. **Global Structural Impact** (Image 3): Does the mutation appear to disturb "
                f"any helix, sheet, or loop in the wider protein context?\n"
                f"5. **Overall Viability Verdict**: Classify this mutation as: "
                f"[Stabilizing / Destabilizing / Neutral / Drug-Resistant] and explain."
            )
        })

        messages = [{"role": "user", "content": content}]
        result = self.chat_completion(messages, reasoning_effort=reasoning_effort)

        # Tag how many images were used for frontend display
        result["vision_metadata"] = {
            "images_used": 3 if full_b64 else 2,
            "prompt_mode": "interleaved_text_image",
            "model": MODEL_NAME,
        }
        return result

    # ── Enhancement 2: Multi-Angle Spatial Reasoning ──────────────────────────
    def analyze_spatial_views(
        self,
        rotation_view_paths: List[str],
        mutation_description: str,
    ) -> Dict[str, Any]:
        """
        Sends 3 rotation-angle views of the mutant pocket to Gemma 4 for
        spatial 3D reasoning. Each image shows the same mutation site from
        a different Y-axis angle (0°, 90°, 180°), enabling the model to
        construct a mental 3D model of the structural change.

        This exploits Gemma 4's ability to reason across multiple related
        images as a pseudo-video / frame sequence.
        """
        angles = [0, 90, 180]
        available = []
        for i, path in enumerate(rotation_view_paths[:3]):
            try:
                b64 = self._img_to_b64(path)
                available.append((angles[i], b64))
            except Exception:
                continue

        if not available:
            raise IOError("No rotation view images could be loaded.")

        content: List[Dict[str, Any]] = [
            {
                "type": "text",
                "text": (
                    f"You are the Spatial Geometry Analysis Agent. "
                    f"You are examining the mutation site from multiple viewing angles.\n"
                    f"Mutation: {mutation_description}\n\n"
                    f"These {len(available)} images show the SAME mutant residue "
                    f"rotated around the Y-axis to reveal its full 3D geometry. "
                    f"Use them together to build a spatial model of the mutation site."
                )
            }
        ]

        for angle, b64 in available:
            content.append({
                "type": "text",
                "text": f"── Rotation View: Y = {angle}° ──"
            })
            content.append(self._img_content(b64))

        content.append({
            "type": "text",
            "text": (
                "── Spatial Analysis Tasks ──\n"
                "Based on all rotation views:\n"
                "1. **3D Volumetric Assessment**: Describe the spatial bulk of the mutant residue "
                "as seen across all angles. Is the side chain protruding into the pocket, "
                "pointing away, or occluding a known binding groove?\n"
                "2. **Angular Exposure**: Which viewing angle reveals the most critical clash or "
                "contact? What does this tell us about the directional impact of the mutation?\n"
                "3. **Buried vs Exposed**: Is the mutation site buried in the protein core "
                "or surface-exposed? How does this affect druggability?\n"
                "4. **Spatial Verdict**: Give a one-sentence 3D geometry verdict."
            )
        })

        messages = [{"role": "user", "content": content}]
        result = self.chat_completion(messages, reasoning_effort="none", temperature=0.15)

        result["vision_metadata"] = {
            "images_used":   len(available),
            "prompt_mode":   "multi_angle_spatial",
            "angles_degrees": [a for a, _ in available],
            "model":         MODEL_NAME,
        }
        return result

    # ── Enhancement 3: Scientific Chart Visual Interpretation ─────────────────
    def interpret_scientific_chart(
        self,
        chart_image_b64: str,
        chart_context: str,
        gene_name: str,
    ) -> Dict[str, Any]:
        """
        Sends a base64-encoded chart image to Gemma 4 for clinical interpretation.
        Used to analyze GTEx tissue expression bar charts and extract
        drug-safety insights (off-target tissue risk, therapeutic window).

        This showcases Gemma 4's chart comprehension multimodal capability.
        """
        content: List[Dict[str, Any]] = [
            {
                "type": "text",
                "text": (
                    f"You are the Clinical Genomics Interpretation Agent. "
                    f"You have been given a scientific chart to analyze for drug development insights.\n\n"
                    f"Gene Target: {gene_name}\n"
                    f"Chart Context: {chart_context}\n\n"
                    f"── CHART IMAGE ──\n"
                    f"The following is a tissue expression profile chart showing "
                    f"RNA transcript levels (TPM = Transcripts Per Million) across human tissues."
                )
            },
            self._img_content(chart_image_b64),
            {
                "type": "text",
                "text": (
                    "── Clinical Analysis Tasks ──\n"
                    "Based on the tissue expression chart above:\n"
                    "1. **Primary Expression Sites**: Which 2-3 tissues show the highest expression? "
                    "Are these consistent with the known biology of this gene?\n"
                    "2. **Off-Target Toxicity Risk**: Which highly-expressing tissues are NOT "
                    "the intended therapeutic target? These represent systemic toxicity risks for "
                    "any inhibitor or activator drug.\n"
                    "3. **Therapeutic Window**: Based on the expression pattern, would a selective "
                    "inhibitor of this gene have a favorable or unfavorable tissue selectivity profile?\n"
                    "4. **Drug Development Recommendation**: In 1-2 sentences, what does this "
                    "expression landscape mean for drug discovery targeting this gene?\n\n"
                    "Format your response with clear section headers."
                )
            }
        ]

        messages = [{"role": "user", "content": content}]
        result = self.chat_completion(messages, reasoning_effort="none", temperature=0.2)

        result["vision_metadata"] = {
            "images_used":   1,
            "prompt_mode":   "chart_interpretation",
            "gene":          gene_name,
            "model":         MODEL_NAME,
        }
        return result
