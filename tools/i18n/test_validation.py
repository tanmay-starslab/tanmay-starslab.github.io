"""Regression tests for translator mistakes the build must detect."""
import unittest
from build import check_locale, rewrite_url
from verify import fragment_errors


class ValidationTests(unittest.TestCase):
    def test_missing_and_unknown_keys(self):
        problems, missing = check_locale("es", {"wrong": "Hola"}, {"hello": {"text": "Hello"}})
        self.assertEqual(missing, ["hello"])
        self.assertTrue(any("stray" in p for p in problems))

    def test_placeholder_and_link_changes(self):
        source = {"hello": {"text": '<a href="{en_url}" rel="noopener">Read {title}</a>'}}
        good = {"hello": '<a href="{en_url}" rel="noopener">Lire {title}</a>'}
        self.assertEqual(check_locale("fr", good, source)[0], [])
        bad = {"hello": '<a href="https://other.example">Lire</a>'}
        problems, _ = check_locale("fr", bad, source)
        self.assertTrue(any("tags differ" in p for p in problems))
        self.assertTrue(any("placeholders differ" in p for p in problems))

    def test_crossed_and_unclosed_tags(self):
        self.assertTrue(fragment_errors('<a href="#"><strong>Text</a></strong>'))
        self.assertTrue(fragment_errors('<em>Text'))
        self.assertEqual(fragment_errors('<a href="#"><strong>Text</strong></a><br>Next'), [])

    def test_page_and_asset_links(self):
        self.assertEqual(rewrite_url('index.html#research', 'ko'), '/ko/#research')
        self.assertEqual(rewrite_url('useful-links.html#python', 'ko'), '/ko/useful-links.html#python')
        self.assertEqual(rewrite_url('images/photo.webp', 'ar'), '/images/photo.webp')
        self.assertEqual(rewrite_url('#contact', 'ar'), '#contact')
        self.assertEqual(rewrite_url('https://example.com/', 'ar'), 'https://example.com/')


if __name__ == '__main__':
    unittest.main()
