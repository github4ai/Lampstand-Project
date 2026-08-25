import importlib.util
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).with_name("import-hwmr.py")
SPEC = importlib.util.spec_from_file_location("import_hwmr", MODULE_PATH)
assert SPEC and SPEC.loader
IMPORTER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(IMPORTER)


class MorningNourishmentParserTests(unittest.TestCase):
    def test_parses_two_space_template(self):
        verses, commentary = IMPORTER.parse_morning(
            "  Rev. 2:1\n"
            "  These things says He who holds the seven stars.\n"
            "  Rev. 2:7\n"
            "  To him who overcomes, I will give to eat.\n"
            "      In Revelation 2 and 3, Christ is the Spirit."
        )

        self.assertEqual([verse["reference"] for verse in verses], ["Rev. 2:1", "Rev. 2:7"])
        self.assertTrue(all(verse["text"] for verse in verses))
        self.assertEqual(commentary, "In Revelation 2 and 3, Christ is the Spirit.")

    def test_parses_three_space_template(self):
        verses, commentary = IMPORTER.parse_morning(
            "   2 Cor. 4:10-12\n"
            "   Always bearing about in the body the putting to death of Jesus\n"
            "   that the life of Jesus also may be manifested in our body.\n"
            "      After Paul told us that he and his co-workers were burdened."
        )

        self.assertEqual(verses, [{
            "reference": "2 Cor. 4:10-12",
            "text": "Always bearing about in the body the putting to death of Jesus that the life of Jesus also may be manifested in our body.",
        }])
        self.assertEqual(commentary, "After Paul told us that he and his co-workers were burdened.")

    def test_quality_check_rejects_empty_verse_text(self):
        books = [{
            "id": "example",
            "generalSubject": "Example HWMR",
            "structure": "weeks",
            "weeks": [{
                "number": 1,
                "outline": "Example outline",
                "hymn": {"text": "Example hymn"},
                "days": [{
                    "day": day,
                    "pages": [day, day],
                    "todaysReading": "Example reading",
                    "morningVerses": [{"reference": "John 1:1", "text": "" if day == 1 else "In the beginning was the Word."}],
                } for day in range(1, 7)],
            }],
        }]

        with self.assertRaisesRegex(ValueError, "verse text is empty"):
            IMPORTER.validate_books(books)

    def test_quality_check_rejects_incomplete_week(self):
        books = [{
            "id": "incomplete",
            "generalSubject": "Incomplete HWMR",
            "structure": "weeks",
            "weeks": [{"number": 1, "outline": "", "hymn": {"text": ""}, "days": []}],
        }]

        with self.assertRaisesRegex(ValueError, "expected Days 1-6"):
            IMPORTER.validate_books(books)


if __name__ == "__main__":
    unittest.main()
