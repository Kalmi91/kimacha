"""Tests of scripts/grammar-debt-fix.py: parsing, validation and writing, no Gemini call, no network.

Run from the repo root:  python -m unittest scripts/test_grammar_debt_fix.py -v
"""
import copy
import importlib.util
import json
import shutil
import tempfile
import unittest
import unittest.mock
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location("grammar_debt_fix", SCRIPTS / "grammar-debt-fix.py")
fix = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(fix)

L4 = lambda v: {"en": v, "es": v}  # noqa: E731


class VosotrosDetector(unittest.TestCase):
    def test_flags_vosotros_words_and_forms(self):
        for text in ["Vivíais en Puebla.", "Vuestro hijo trabaja", "Os escribo pronto", "ti (vosotros, Spo.)",
                     "Vais a trabajar mañana", "¿Coméis temprano?", "hablad más despacio", "no es nosotros ni vosotros"]:
            self.assertIsNotNone(fix.find_vosotros(text), text)

    def test_ignores_look_alikes(self):
        for text in ["tanto/a/os/as ... como", "dieciséis años", "Nosotros vivimos aquí", "Los niños comen",
                     "Ustedes hablan muy rápido", "el país", "mucho/a/os/as + sustantivo"]:
            self.assertIsNone(fix.find_vosotros(text), text)

    def test_looks_into_nested_values_and_keys(self):
        self.assertEqual(fix.find_vosotros({"wrong": {"vais": L4("x")}}), "vais")
        self.assertIsNone(fix.find_vosotros({"a": ["ustedes", {"b": "ellos"}]}))


class MatchValidation(unittest.TestCase):
    pairs = [
        {"es": "tuve un problema", "en": "I had a problem"},
        {"es": "fuimos al cine", "en": "we went to the movies"},
        {"es": "ella dijo que sí", "en": "she said yes"},
        {"es": "vinieron sin avisar", "en": "they came without warning"},
        {"es": "no pude dormir", "en": "I couldn't sleep"},
    ]

    def good(self):
        return [{"i": 0, "es": "tuve", "en": "I had"}, {"i": 1, "es": "fuimos", "en": "we went"},
                {"i": 2, "es": "dijo", "en": "she said"}, {"i": 3, "es": "vinieron", "en": "they came"},
                {"i": 4, "es": "pude", "en": "I could"}]

    def test_accepts_the_key_parts(self):
        new, err = fix.validate_match("es", self.pairs, self.good())
        self.assertIsNone(err)
        self.assertEqual(new[0], {"es": "tuve", "en": "I had"})

    def test_strips_final_punctuation(self):
        res = self.good()
        res[2]["en"] = "she said."
        new, err = fix.validate_match("es", self.pairs, res)
        self.assertIsNone(err)
        self.assertEqual(new[2]["en"], "she said")

    def test_learned_side_must_be_part_of_the_original_of_the_same_pair(self):
        res = self.good()
        res[0]["es"] = "fuimos"  # a part of another pair: the pairing would change
        _, err = fix.validate_match("es", self.pairs, res)
        self.assertIn("not a part", err)

    def test_word_limits(self):
        res = self.good()
        res[1]["es"] = "fuimos al cine ahora"
        _, err = fix.validate_match("es", [dict(p) for p in self.pairs[:1]] + [{"es": "fuimos al cine ahora", "en": "x"}] + self.pairs[2:], res)
        self.assertIn("too long", err)
        res = self.good()
        res[4]["en"] = "I really could not sleep"
        _, err = fix.validate_match("es", self.pairs, res)
        self.assertIn("too long", err)

    def test_en_track_swaps_the_roles(self):
        pairs = [
            {"es": "Yo te ayudaré.", "en": "I will help you."},
            {"es": "Mañana lloverá.", "en": "It will rain tomorrow."},
            {"es": "No llegaré tarde.", "en": "I won't be late."},
            {"es": "¿Me ayudarás?", "en": "Will you help me?"},
            {"es": "Lo haré hoy.", "en": "I'll do it today."},
        ]
        res = [{"i": 0, "en": "will help", "es": "ayudaré"}, {"i": 1, "en": "will rain", "es": "lloverá"},
               {"i": 2, "en": "won't be", "es": "no seré"}, {"i": 3, "en": "Will you", "es": "¿ayudarás?"},
               {"i": 4, "en": "I'll do", "es": "haré"}]
        new, err = fix.validate_match("en", pairs, res)
        self.assertIsNone(err)
        self.assertEqual(new[3], {"es": "ayudarás", "en": "Will you"})
        res[1]["en"] = "will snow"
        _, err = fix.validate_match("en", pairs, res)
        self.assertIn("not a part", err)

    def test_rejects_duplicates_identical_sides_and_wrong_shape(self):
        res = self.good()
        res[1]["es"] = "fuimos"
        res[1]["en"] = "I had"
        _, err = fix.validate_match("es", self.pairs, res)
        self.assertIn("duplicate en", err)
        res = self.good()
        res[0]["en"] = "tuve"
        _, err = fix.validate_match("es", self.pairs, res)
        self.assertIn("identical", err)
        _, err = fix.validate_match("es", self.pairs, self.good()[:4])
        self.assertIn("number of pairs", err)
        res = self.good()
        res[0]["i"] = 1
        _, err = fix.validate_match("es", self.pairs, res)
        self.assertIsNotNone(err)

    def test_rejects_vosotros(self):
        pairs = [{"es": "habíais dicho", "en": "you had said"}] + self.pairs[1:]
        res = self.good()
        res[0] = {"i": 0, "es": "habíais", "en": "you had"}
        _, err = fix.validate_match("es", pairs, res)
        self.assertIn("vosotros", err)


MATCH_MULTILINE = """{
  "schema": 2,
  "topic": "demo",
  "items": [
    {
      "id": "d-match-01",
      "kind": "match",
      "pairs": [
        {
          "es": "tuve un problema",
          "en": "I had a problem"
        },
        {
          "es": "fuimos al cine",
          "en": "we went to the movies"
        },
        {
          "es": "ella dijo que sí",
          "en": "she said yes"
        },
        {
          "es": "vinieron sin avisar",
          "en": "they came without warning"
        },
        {
          "es": "no pude dormir",
          "en": "I couldn't sleep"
        }
      ],
      "tense": { "from": "presente", "to": "indefinido" }
    },
    {
      "id": "d-other-02",
      "kind": "form",
      "verb": "ser"
    }
  ]
}
"""

MATCH_INLINE = MATCH_MULTILINE.replace(
    "\n        {\n          \"es\": ", "\n        { \"es\": "
).replace("\",\n          \"en\": ", "\", \"en\": ").replace("\"\n        }", "\" }")


class MatchWriting(unittest.TestCase):
    new_pairs = [{"es": "tuve", "en": "I had"}, {"es": "fuimos", "en": "we went"}, {"es": "dijo", "en": "she said"},
                 {"es": "vinieron", "en": "they came"}, {"es": "pude", "en": "I could"}]

    def check(self, raw):
        json.loads(raw)
        new_raw = fix.apply_match(raw, {"d-match-01": self.new_pairs})
        old = json.loads(raw)
        expected = {"d-match-01": fix.with_pairs(old["items"][0], self.new_pairs)}
        fix.verify_replacement(raw, new_raw, expected)
        self.assertEqual(json.loads(new_raw)["items"][0]["pairs"], self.new_pairs)
        self.assertEqual(json.loads(new_raw)["items"][1], old["items"][1])
        return new_raw

    def test_multiline_pairs_keep_their_layout(self):
        new_raw = self.check(MATCH_MULTILINE)
        self.assertIn('        {\n          "es": "tuve",\n          "en": "I had"\n        },', new_raw)
        self.assertIn('"tense": { "from": "presente", "to": "indefinido" }', new_raw)

    def test_inline_pairs_keep_their_layout(self):
        self.assertIn('{ "es": "tuve un problema"', MATCH_INLINE)
        new_raw = self.check(MATCH_INLINE)
        self.assertIn('        { "es": "tuve", "en": "I had" },', new_raw)

    def test_crlf_file_stays_crlf(self):
        raw = MATCH_MULTILINE.replace("\n", "\r\n")
        new_raw = fix.apply_match(raw, {"d-match-01": self.new_pairs})
        self.assertEqual(new_raw.count("\n"), new_raw.count("\r\n"))
        old = json.loads(raw)
        fix.verify_replacement(raw, new_raw, {"d-match-01": fix.with_pairs(old["items"][0], self.new_pairs)})

    def test_verify_catches_a_stray_change(self):
        new_raw = fix.apply_match(MATCH_MULTILINE, {"d-match-01": self.new_pairs}).replace('"ser"', '"estar"')
        old = json.loads(MATCH_MULTILINE)
        with self.assertRaises(ValueError):
            fix.verify_replacement(MATCH_MULTILINE, new_raw, {"d-match-01": fix.with_pairs(old["items"][0], self.new_pairs)})


def why_item():
    return {
        "kind": "why", "id": "t-why-03", "es": "Vivía en Puebla.", "target": "Vivía",
        "tr": L4("Vivía en Puebla."),
        "options": [
            {"text": L4("él/ella"), },
            {"text": L4("nosotros"), "wrong": L4("Si fuera nosotros, diría 'Vivíamos en Puebla', no él o ella.")},
            {"text": {"en": "you all (vosotros, Spain)", "es": "vosotros"},
             "wrong": L4("Si fuera vosotros, diría 'Vivíais en Puebla', no solo él o ella.")},
        ],
        "correctIndex": 0,
        "tense": {"from": "presente", "to": "imperfecto"},
    }


def gap_item():
    return {
        "id": "t-03", "sentence": "Nosotros ___ en la ciudad.", "options": ["vivimos", "vivís", "viven"], "correct": 0,
        "why": L4("La forma de nosotros es vivimos."),
        "wrong": {"vivís": L4("Vivís es de vosotros y no se usa en México."), "viven": L4("Viven es de ellos, aquí hablamos de nosotros.")},
        "examples": ["Nosotros comemos a las dos."], "tr": L4("Vivimos en la ciudad."),
    }


class VosotrosValidation(unittest.TestCase):
    def fixed_why(self):
        new = why_item()
        new["options"][2] = {
            "text": {"en": "they / you all (ellos/ustedes)", "es": "ellos/ustedes"},
            "wrong": {
                "en": "If it were ellos, it would say 'Vivían en Puebla', meaning THEY lived there, not just him or her.",
                "es": "Si fuera ellos, diría 'Vivían en Puebla', o sea que ELLOS vivían ahí, no solo él o ella.",
            },
        }
        return new

    def test_accepts_a_clean_rewrite_of_a_why_item(self):
        new, err = fix.validate_vosotros(why_item(), self.fixed_why())
        self.assertIsNone(err)
        self.assertIsNone(fix.find_vosotros(new))

    def test_why_rejections(self):
        old = why_item()
        bad = self.fixed_why()
        bad["options"][2]["wrong"]["es"] = "Si fuera vosotros, diría 'Vivíais en Puebla', o sea que ustedes vivían."
        self.assertIn("vosotros left", fix.validate_vosotros(old, bad)[1])
        bad = self.fixed_why()
        bad["correctIndex"] = 1
        self.assertIn("must not change", fix.validate_vosotros(old, bad)[1])
        bad = self.fixed_why()
        bad["options"][0]["text"]["en"] = "someone else"
        self.assertIn("correct option changed", fix.validate_vosotros(old, bad)[1])
        bad = self.fixed_why()
        bad["options"][2]["wrong"]["en"] = "No."
        self.assertIn("real sentences", fix.validate_vosotros(old, bad)[1])
        bad = self.fixed_why()
        del bad["options"][2]["text"]["es"]
        self.assertIn("2 languages", fix.validate_vosotros(old, bad)[1])
        bad = self.fixed_why()
        bad["options"][2]["text"]["en"] = "nosotros"
        self.assertIn("not unique", fix.validate_vosotros(old, bad)[1])
        bad = self.fixed_why()
        bad["es"] = "Vivían en Puebla."
        self.assertIn("must not change", fix.validate_vosotros(old, bad)[1])
        bad = self.fixed_why()
        bad["extra"] = 1
        self.assertIn("keys", fix.validate_vosotros(old, bad)[1])

    def test_gap_item(self):
        old = gap_item()
        new = copy.deepcopy(old)
        new["options"] = ["vivimos", "vivo", "viven"]
        new["wrong"] = {
            "vivo": L4("Vivo es la forma de yo, y aquí el sujeto es nosotros: vivimos."),
            "viven": old["wrong"]["viven"],
        }
        got, err = fix.validate_vosotros(old, new)
        self.assertIsNone(err)
        bad = copy.deepcopy(new)
        bad["options"][0] = "vivo"
        self.assertIn("correct option changed", fix.validate_vosotros(old, bad)[1])
        bad = copy.deepcopy(new)
        bad["wrong"]["vivís"] = bad["wrong"].pop("vivo")
        self.assertIsNotNone(fix.validate_vosotros(old, bad)[1])
        bad = copy.deepcopy(new)
        bad["wrong"]["vivo"] = L4("corto")
        self.assertIn("40 characters", fix.validate_vosotros(old, bad)[1])
        self.assertIn("vosotros left", fix.validate_vosotros(old, copy.deepcopy(old))[1])

    def test_vosotros_in_a_frozen_field_needs_a_hand_edit(self):
        old = why_item()
        old["tr"]["es"] = "Vivís en Puebla."
        new = self.fixed_why()
        new["tr"]["es"] = "Vivís en Puebla."
        self.assertIn("hand edit", fix.validate_vosotros(old, new)[1])


LESSON = """{
  "schema": 2,
  "topic": "demo",
  "title": { "en": "Demo", "es": "Demo" },
  "items": [
    {
      "id": "t-03",
      "sentence": "Nosotros ___ en la ciudad.",
      "options": ["vivimos", "vivís", "viven"],
      "correct": 0,
      "why": { "en": "b", "es": "c" },
      "wrong": {
        "vivís": { "en": "Vivís is the vosotros form, not used in Mexico.", "es": "Vivís es de vosotros y no se usa en México." },
        "viven": { "en": "Viven is the ellos form, here the subject is nosotros.", "es": "Viven es de ellos, aquí hablamos de nosotros." }
      },
      "examples": ["Nosotros comemos a las dos."],
      "tr": { "en": "t", "es": "Vivimos en la ciudad." }
    },
    {
      "id": "t-04",
      "sentence": "Ellos ___ aquí.",
      "options": ["viven", "vive"],
      "correct": 0
    }
  ]
}
"""


class ItemRewriting(unittest.TestCase):
    def test_apply_items_reserialises_only_that_item(self):
        old = json.loads(LESSON)
        new_item = copy.deepcopy(old["items"][0])
        new_item["options"] = ["vivimos", "vivo", "viven"]
        new_item["wrong"] = {"vivo": L4("Vivo es la forma de yo, aquí el sujeto es nosotros."), "viven": new_item["wrong"]["viven"]}
        new_raw = fix.apply_items(LESSON, {"t-03": new_item})
        fix.verify_replacement(LESSON, new_raw, {"t-03": new_item})
        self.assertIn('"options": ["vivimos", "vivo", "viven"]', new_raw)  # inline lists stay inline
        self.assertIn('"id": "t-04"', new_raw)
        self.assertEqual(json.loads(new_raw)["items"][1], old["items"][1])

    def test_dump_item_round_trips_every_real_vosotros_item(self):
        work, stale = fix.collect_work(("vosotros",), None)
        self.assertEqual(stale, [])
        self.assertEqual(len(work), len(fix.read_debt("vosotros")))
        for w in work:
            for inline in (True, False):
                self.assertEqual(json.loads(fix.dump_item(w["item"], 4, inline)), w["item"], w["key"])


class DebtFlow(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        (self.tmp / "grammar" / "es").mkdir(parents=True)
        (self.tmp / "grammar" / "es" / "demo.json").write_text(MATCH_MULTILINE, encoding="utf-8", newline="\n")
        self.scripts = self.tmp / "scripts"
        self.scripts.mkdir()
        (self.scripts / "audit-games-match-debt.json").write_text(json.dumps(["es/demo.json#d-match-01", "es/other.json#x"], indent=2) + "\n")
        self.saved = fix.SCRIPTS
        fix.SCRIPTS = self.scripts

    def tearDown(self):
        fix.SCRIPTS = self.saved
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_process_batch_writes_good_items_and_shrinks_the_debt_list(self):
        work, stale = fix.collect_work(("match",), None, grammar=self.tmp / "grammar")
        self.assertEqual(stale, ["es/other.json#x"])
        self.assertEqual(len(work), 1)
        good = [{"i": 0, "es": "tuve", "en": "I had"}, {"i": 1, "es": "fuimos", "en": "we went"}, {"i": 2, "es": "dijo", "en": "she said"},
                {"i": 3, "es": "vinieron", "en": "they came"}, {"i": 4, "es": "pude", "en": "I could"}]
        bad = copy.deepcopy(good)
        bad[0]["es"] = "fuimos"
        # a bad answer: nothing is written, the item stays on the list
        fixed, failed = fix.process_batch("match", work, [{"id": "0", "pairs": bad}])
        self.assertEqual(fixed, [])
        self.assertEqual(failed[0][0], "es/demo.json#d-match-01")
        self.assertEqual((self.tmp / "grammar" / "es" / "demo.json").read_text(encoding="utf-8"), MATCH_MULTILINE)
        self.assertIn("es/demo.json#d-match-01", fix.read_debt("match"))
        # a good answer: written, removed from the list, the other debt entry stays
        fixed, failed = fix.process_batch("match", work, [{"id": "0", "pairs": good}])
        self.assertEqual((fixed, failed), (["es/demo.json#d-match-01"], []))
        self.assertEqual(fix.read_debt("match"), ["es/other.json#x"])
        after = json.loads((self.tmp / "grammar" / "es" / "demo.json").read_text(encoding="utf-8"))
        self.assertEqual([p["es"] for p in after["items"][0]["pairs"]], ["tuve", "fuimos", "dijo", "vinieron", "pude"])
        self.assertEqual(after["items"][1], {"id": "d-other-02", "kind": "form", "verb": "ser"})

    def test_a_missing_answer_is_reported_not_written(self):
        work, _ = fix.collect_work(("match",), None, grammar=self.tmp / "grammar")
        fixed, failed = fix.process_batch("match", work, [])
        self.assertEqual((fixed, failed), ([], [("es/demo.json#d-match-01", "no answer")]))


class RealDebtLists(unittest.TestCase):
    def test_every_debt_key_resolves_to_an_item(self):
        work, stale = fix.collect_work(tuple(fix.KINDS), None)
        self.assertEqual(stale, [])
        self.assertEqual(len(work), sum(len(fix.read_debt(k)) for k in fix.KINDS))

    def test_match_limits_equal_the_audit(self):
        audit = (SCRIPTS / "audit-games.mjs").read_text(encoding="utf-8")
        self.assertIn("const MATCH_MAX_WORDS = { es: { es: 3, en: 4 }, en: { es: 4, en: 4 } };", audit)
        self.assertEqual(fix.MATCH_MAX, {"es": {"es": 3, "en": 4}, "en": {"es": 4, "en": 4}})

    def test_prompts_name_the_mexican_norm_and_hold_no_key(self):
        work, _ = fix.collect_work(("match", "match-en", "vosotros"), None)
        for kind in ("match", "match-en", "vosotros"):
            batch = [w for w in work if w["kind"] == kind][:2]
            prompt = fix.prompt_for(kind, batch)
            self.assertIn("Mexican", prompt)
            self.assertNotIn("GEMINI_API_KEY", prompt)


class GeminiCall(unittest.TestCase):
    """The request goes out with the key in a header only; the answer is parsed; nothing touches the network."""

    def test_call_gemini_sends_the_key_in_a_header_and_parses_the_answer(self):
        seen = {}

        class Resp:
            def __enter__(self):
                return self

            def __exit__(self, *a):
                return False

            def read(self):
                return json.dumps({"candidates": [{"content": {"parts": [{"text": json.dumps([{"id": "0"}])}]}}]}).encode()

        def fake_urlopen(req, timeout=0):
            seen["headers"] = {k.lower(): v for k, v in req.header_items()}
            seen["url"] = req.full_url
            seen["body"] = json.loads(req.data.decode("utf-8"))
            return Resp()

        with unittest.mock.patch.object(fix.urllib.request, "urlopen", fake_urlopen):
            out = fix.call_gemini("FAKEKEY", "gemini-2.5-flash", "prompt text", fix.match_schema())
        self.assertEqual(out, [{"id": "0"}])
        self.assertEqual(seen["headers"]["x-goog-api-key"], "FAKEKEY")
        self.assertNotIn("FAKEKEY", seen["url"])
        self.assertNotIn("FAKEKEY", json.dumps(seen["body"]))
        self.assertEqual(seen["body"]["generationConfig"]["responseMimeType"], "application/json")
        self.assertIn("responseSchema", seen["body"]["generationConfig"])


class MainFlow(unittest.TestCase):
    """main() end to end with a canned model answer: no key in the output, the item is fixed and leaves the list."""

    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        (self.tmp / "grammar" / "es").mkdir(parents=True)
        (self.tmp / "grammar" / "es" / "demo.json").write_text(MATCH_MULTILINE, encoding="utf-8", newline="\n")
        (self.tmp / "scripts").mkdir()
        for name in ("audit-games-match-debt.json", "audit-games-match-debt-en.json", "audit-games-vosotros-debt.json"):
            data = ["es/demo.json#d-match-01"] if name == "audit-games-match-debt.json" else []
            (self.tmp / "scripts" / name).write_text(json.dumps(data) + "\n", encoding="utf-8", newline="\n")
        self.saved = (fix.SCRIPTS, fix.GRAMMAR, fix.call_gemini, fix.run_audit)
        fix.SCRIPTS, fix.GRAMMAR = self.tmp / "scripts", self.tmp / "grammar"
        fix.run_audit = lambda: 0

    def tearDown(self):
        fix.SCRIPTS, fix.GRAMMAR, fix.call_gemini, fix.run_audit = self.saved
        shutil.rmtree(self.tmp, ignore_errors=True)

    def run_main(self, argv, env):
        import contextlib
        import io
        buf = io.StringIO()
        with unittest.mock.patch("sys.argv", ["grammar-debt-fix.py", *argv]), \
                unittest.mock.patch.dict("os.environ", env, clear=False), \
                contextlib.redirect_stdout(buf):
            code = fix.main()
        return code, buf.getvalue()

    def test_no_key_stops_before_any_call(self):
        fix.call_gemini = lambda *a, **k: self.fail("must not call the API without a key")
        with unittest.mock.patch.dict("os.environ", {}, clear=False):
            import os
            os.environ.pop("GEMINI_API_KEY", None)
            code, out = self.run_main(["--only", "match"], {})
        self.assertEqual(code, 2)
        self.assertIn("GEMINI_API_KEY", out)

    def test_dry_run_needs_no_key_and_writes_nothing(self):
        fix.call_gemini = lambda *a, **k: self.fail("dry run must not call the API")
        code, out = self.run_main(["--dry-run", "--only", "match"], {})
        self.assertEqual(code, 0)
        self.assertIn("1 tétel", out)
        self.assertEqual((self.tmp / "grammar" / "es" / "demo.json").read_text(encoding="utf-8"), MATCH_MULTILINE)

    def test_full_run_with_a_canned_answer(self):
        good = [{"i": 0, "es": "tuve", "en": "I had"}, {"i": 1, "es": "fuimos", "en": "we went"}, {"i": 2, "es": "dijo", "en": "she said"},
                {"i": 3, "es": "vinieron", "en": "they came"}, {"i": 4, "es": "pude", "en": "I could"}]
        fix.call_gemini = lambda key, model, prompt, schema=None, retries=5: [{"id": "0", "pairs": good}]
        with unittest.mock.patch.object(fix.time, "sleep", lambda s: None):
            code, out = self.run_main(["--only", "match"], {"GEMINI_API_KEY": "SECRETKEY123"})
        self.assertEqual(code, 0)
        self.assertNotIn("SECRETKEY123", out)
        self.assertEqual(fix.read_debt("match"), [])
        after = json.loads((self.tmp / "grammar" / "es" / "demo.json").read_text(encoding="utf-8"))
        self.assertEqual(after["items"][0]["pairs"][0], {"es": "tuve", "en": "I had"})


class VosotrosFlow(unittest.TestCase):
    """process_batch for a vosotros item: the rewritten item is written in place and leaves the debt list."""

    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        (self.tmp / "grammar" / "es").mkdir(parents=True)
        self.lesson = self.tmp / "grammar" / "es" / "demo.json"
        self.lesson.write_text(LESSON, encoding="utf-8", newline="\n")
        (self.tmp / "scripts").mkdir()
        (self.tmp / "scripts" / "audit-games-vosotros-debt.json").write_text(json.dumps(["es/demo.json#t-03"]) + "\n", encoding="utf-8", newline="\n")
        self.saved = fix.SCRIPTS
        fix.SCRIPTS = self.tmp / "scripts"

    def tearDown(self):
        fix.SCRIPTS = self.saved
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_good_and_bad_answers(self):
        work, stale = fix.collect_work(("vosotros",), None, grammar=self.tmp / "grammar")
        self.assertEqual(stale, [])
        old = json.loads(LESSON)["items"][0]
        bad = copy.deepcopy(old)  # the model gave the item back untouched: still names vosotros
        fixed, failed = fix.process_batch("vosotros", work, [{"id": "0", "item": bad}])
        self.assertEqual(fixed, [])
        self.assertEqual([k for k, _ in failed], ["es/demo.json#t-03"])
        self.assertEqual(self.lesson.read_text(encoding="utf-8"), LESSON)
        good = copy.deepcopy(old)
        good["options"] = ["vivimos", "vivo", "viven"]
        good["wrong"] = {"vivo": L4("Vivo es la forma de yo, aquí el sujeto es nosotros: vivimos."), "viven": old["wrong"]["viven"]}
        fixed, failed = fix.process_batch("vosotros", work, [{"id": "0", "item": good}])
        self.assertEqual((fixed, failed), (["es/demo.json#t-03"], []))
        self.assertEqual(fix.read_debt("vosotros"), [])
        after = json.loads(self.lesson.read_text(encoding="utf-8"))
        self.assertEqual(after["items"][0], good)
        self.assertEqual(after["items"][1], json.loads(LESSON)["items"][1])
        self.assertIsNone(fix.find_vosotros(after["items"][0]))


if __name__ == "__main__":
    unittest.main()
