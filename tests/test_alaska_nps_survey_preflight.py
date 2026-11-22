"""Offline contract tests for bounded NPS Sawyer source preflight."""
import importlib.util
import pathlib
import tempfile
import unittest

SOURCE = pathlib.Path(__file__).resolve().parents[1] / "tools/alaska/probe_nps_sawyer_surveys.py"
spec = importlib.util.spec_from_file_location("nps_sawyer_probe", SOURCE)
probe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(probe)


class NpsSawyerSourceProbeTests(unittest.TestCase):
    def test_publisher_catalog_resource_ids(self):
        self.assertEqual(probe.SOURCES, (("Sawyer", "744015"), ("SouthSawyer", "744024")))
        self.assertEqual(probe.download_url("744015"),
            "https://irma.nps.gov/DataStore/DownloadFile/744015?Reference=2314560")
        self.assertEqual(probe.download_url("744024"),
            "https://irma.nps.gov/DataStore/DownloadFile/744024?Reference=2314560")
        with self.assertRaises(ValueError):
            probe.download_url("744024?other=1")

    def test_zip_signature_not_content_type_alone(self):
        self.assertTrue(probe.is_archive_header("application/zip", b"PK\x03\x04xyz"))
        self.assertTrue(probe.is_archive_header("application/octet-stream", b"PK\x03\x04xyz"))
        self.assertFalse(probe.is_archive_header("text/html", b"PK\x03\x04xyz"))
        self.assertFalse(probe.is_archive_header("application/zip", b"<html>"))
        self.assertFalse(probe.is_archive_header("application/json", b'{"error":true}'))

    def test_catalog_only_is_not_misreported_as_downloaded(self):
        with tempfile.TemporaryDirectory() as directory:
            report = pathlib.Path(directory) / "report.json"
            self.assertEqual(probe.run(["--offline", "--output", str(report)]), 0)
            self.assertTrue(report.is_file())
            import json
            result = json.loads(report.read_text(encoding="utf-8"))
            self.assertEqual(result["status"], "CATALOG_ONLY")
            self.assertFalse(result["network_tested"])
            self.assertTrue(all(
                x["status"] == "NOT_NETWORK_TESTED" for x in result["sources"]
            ))
            self.assertIn("raster footprint, CRS, vertical datum and NoData",
                          result["not_verified"])


if __name__ == "__main__":
    unittest.main()
