"""Generate fresh synthetic raster-only oracles for three native R06 qualifiers.

Oracle text is private metadata and pixels only: never filenames, prompts,
stdout, EXIF, PNG text chunks, WebP metadata or durable public evidence.
"""
from pathlib import Path,PurePosixPath
import hashlib
import json
import secrets
import uuid
from PIL import Image,ImageDraw,ImageFont,__version__ as pillow_version

ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'.tmp/ai40-r06-images-r01'
PRIVATE=OUT/'private-fixtures'
REMOTE=PurePosixPath('/opt/nodia/verification/ai40-r06-image-fixtures-r01')
FONT=Path('C:/Windows/Fonts/consolab.ttf')

def sha(b):return hashlib.sha256(b).hexdigest()

def main():
    OUT.mkdir();PRIVATE.mkdir()
    font=ImageFont.truetype(str(FONT),80)
    probes={};public=[];codes=set()
    for kind,mime in (('png','image/png'),('jpeg','image/jpeg'),('webp','image/webp')):
        code=secrets.token_hex(10).upper()
        assert code not in codes;codes.add(code)
        name=uuid.uuid4().hex+'.'+kind
        image=Image.new('RGB',(1400,300),'white');draw=ImageDraw.Draw(image)
        box=draw.textbbox((0,0),code,font=font)
        assert box[2]-box[0]<1200 and box[3]-box[1]<160
        draw.text(((1400-(box[2]-box[0]))//2-box[0],(300-(box[3]-box[1]))//2-box[1]),code,font=font,fill='black')
        path=PRIVATE/name
        options={'png':{'optimize':True},'jpeg':{'quality':95,'subsampling':0,'optimize':True},'webp':{'lossless':True,'method':6}}[kind]
        image.save(path,format={'png':'PNG','jpeg':'JPEG','webp':'WEBP'}[kind],**options)
        raw=path.read_bytes();assert code.encode() not in raw and len(raw)<20971520
        with Image.open(path) as check:
            assert check.size==(1400,300) and check.format=={'png':'PNG','jpeg':'JPEG','webp':'WEBP'}[kind]
            assert not check.getexif() and not any(k.lower() in ('comment','description','xmp','xml','icc_profile') for k in check.info)
        probes[kind]={'path':str(REMOTE/name),'media_type':mime,'sha256':sha(raw),'expected_code':code}
        public.append({'kind':kind,'media_type':mime,'opaque_filename':name,'sha256':sha(raw),'bytes':len(raw),'width':1400,'height':300,'oracle_sha256':sha(code.encode()),'oracle_location':'raster pixels only; private expected_code for exact validator','metadata_contains_oracle':False})
    (PRIVATE/'private-probes.json').write_text(json.dumps(probes)+'\n',encoding='utf-8',newline='\n')
    public_manifest={'schema':'nodia-ai-ai40-r06-native-image-fixtures-v1','generator_sha256':sha(Path(__file__).read_bytes()),'pillow_version':pillow_version,'font_sha256':sha(FONT.read_bytes()),'fixtures':public,'provider_generations':0,'provider_observations':0,'private_oracles_emitted':False}
    (OUT/'fixtures-public.json').write_text(json.dumps(public_manifest,indent=2)+'\n',encoding='utf-8',newline='\n')
    print(json.dumps(public_manifest))

if __name__=='__main__':main()
