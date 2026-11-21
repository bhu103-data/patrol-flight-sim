"""Read-only rights/geometry inventory for OFFICIAL FlightGear Cessna-180.zip.
Cessna 180 hydroplane is NOT a Cessna 185. No geometry or texture imported.
"""
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
import re
import sys
from pathlib import Path
from zipfile import ZipFile, BadZipFile

SOURCE="https://mirrors.ibiblio.org/flightgear/ftp/Aircraft-trunk/Cessna-180.zip"
ZIP=Path("/tmp/flightgear-Cessna-180.zip")
OUT=Path("artifacts/c185-asset-review/flightgear-C180-source-inventory.json")
OUT.parent.mkdir(parents=True,exist_ok=True)
def out(obj):
    OUT.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+"\n")
    print(json.dumps({
        "downloaded":obj.get("downloaded"),
        "sourceBytes":obj.get("sourceBytes"),
        "fileCount":obj.get("fileCount"),
        "aircraftVariants":obj.get("aircraftVariants"),
        "licenseFiles":obj.get("licenseFiles"),
        "floatModels":obj.get("floatModels"),
        "error":obj.get("error")
    },ensure_ascii=False,indent=2))
try:
    buf=ZIP.read_bytes()
    if not (1000000<len(buf)<120000000):
        raise ValueError("Official ZIP outside bounded byte range")
    with ZipFile(ZIP) as archive:
        entries=[x for x in archive.infolist() if not x.is_dir()]
        if len(entries)>15000:
            raise ValueError("Too many archive entries")
        if sum(x.file_size for x in entries)>1000000000:
            raise ValueError("Excessive inflated archive size")
        paths=[i.filename for i in entries]
        def matches(rx):
            return [p for p in paths if re.search(rx,p,re.I)]
        license_paths=matches(r"(^|/)(COPYING|LICENSE|LICENCE|AUTHORS|COPYRIGHT|CREDITS|README)([./_-]|$)")
        credit=[]
        for p in license_paths[:35]:
            info=archive.getinfo(p)
            if info.file_size>150000:continue
            txt=archive.read(p).decode("utf-8",errors="replace")
            credit.append({
                "path":p,
                "textFirst2000":txt[:2000],
                "containsGPL":bool(re.search(r"GNU General Public License|GPLv?2|GPL-2",txt,re.I))
            })
        fpaths=matches(r"float|water|hydro|seaplane|pontoon|amphib|bush")
        model_paths=matches(r"\.(ac|obj|stl|blend|glb|gltf|osg)$")
        texture_paths=matches(r"\.(png|jpe?g|webp|dds|bmp|tiff?|rgb)$")
        xmlpaths=matches(r"\.(xml|nas|set)$")
        model_records=[]
        for p in model_paths:
            info=archive.getinfo(p)
            record={"path":p,"bytes":info.file_size}
            if p.lower().endswith(".ac") and info.file_size<6000000:
                raw=archive.read(p)
                txt=raw.decode("latin-1",errors="replace")
                surfaces=[int(m) for m in re.findall(r"(?m)^numsurf\s+(\d+)\s*$",txt)]
                refs=[int(m) for m in re.findall(r"(?m)^refs\s+(\d+)\s*$",txt)]
                objects=re.findall(r'(?m)^name\\s+"([^"]+)"',txt)
                named_float_objects=[n for n in objects if re.search(r"float|pontoon|hydro|water|gear|rudder",n,re.I)]
                record.update({
                    "modelObjectNames":objects[:70],
                    "namedFloatGearRudderParts":named_float_objects[:45],
                    "objects":len(surfaces),
                    "faceCount":sum(surfaces),
                    "triangulatedFanUpperBound":sum(max(0,n-2) for n in refs),
                    "vertices":sum(int(m) for m in re.findall(r"(?m)^numvert\s+(\d+)\s*$",txt)),
                    "externalTextures":re.findall(r"(?m)^texture\s+\"([^\"]+)\"",txt)[:25],
                })
            model_records.append(record)
        variant_names=matches(r"(?i)(^|/)[^/]*(Cessna|c180|skywagon|hydro|float)[^/]*-set\.xml$")
        variant_configuration=[]
        for path in variant_names:
            blob=archive.read(path).decode("utf-8",errors="replace")
            hits=[line.strip() for line in blob.splitlines()
                if re.search(r"float|hydro|gear|models|[.]ac<",line,re.I)]
            variant_configuration.append({"path":path,"floatOrModelLines":hits[:65]})
        references=[]
        for p in xmlpaths:
            low=p.lower()
            if not any(v in low for v in ("180","float","hydro","water","set")):
                continue
            info=archive.getinfo(p)
            if info.file_size>350000:continue
            txt=archive.read(p).decode("utf-8",errors="replace")
            names=sorted(set(re.findall(r"(?i)[\w/.-]*(?:float|water|hydro|pontoon)[\w/.-]*\.(?:ac|xml|png|jpg)",txt)))
            if names:
                references.append({"path":p,"floatFilesReferenced":names[:45]})
        report={
            "downloaded":True,"source":SOURCE,
            "retrievedAt":datetime.now(timezone.utc).isoformat(),
            "sourceBytes":len(buf),"sourceSHA256":hashlib.sha256(buf).hexdigest(),
            "aircraft":"Cessna 180 Skywagon, NOT Cessna 185",
            "flightgearPolicy":"GPL-2.0-or-later compatible contributions; actual file rights must be preserved",
            "fileCount":len(entries),
            "inflatedBytes":sum(x.file_size for x in entries),
            "fileTypeCounts":dict(Counter(Path(p).suffix.lower() for p in paths)),
            "aircraftVariants":variant_names[:80],
            "variantConfigurationEvidence":variant_configuration,
            "floatNames":fpaths[:120],
            "licenseFiles":credit,
            "floatModels":[r for r in model_records if
                re.search(r"float|hydro|water|pontoon",r["path"],re.I) or r.get("namedFloatGearRudderParts")][:45],
            "allModelRecords":model_records[:320],
            "materialImages":len(texture_paths),
            "textureUncompressedBytes":sum(x.file_size for x in entries if x.filename in texture_paths),
            "textureFiles":texture_paths[:90],
            "floatModelReferences":references[:60],
            "standaloneWebGLCompatible":False,
            "licensedToRelabelAsC185":False,
            "sourceImportedIntoPATROL":False,
            "exactC185":False,
            "waterlineVerified":False,
        }
        out(report)
except (FileNotFoundError,ValueError,BadZipFile) as err:
    out({"downloaded":False,"source":SOURCE,"error":str(err)})
    sys.exit(1)
