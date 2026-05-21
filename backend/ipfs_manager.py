import os
import requests
from dotenv import load_dotenv

load_dotenv()

# The JWT is your long 'JSON Web Token' from Pinata
PINATA_JWT = os.getenv("PINATA_JWT")

def pin_to_ipfs(filepath):
    #Uploads a file to Pinata IPFS and returns the CID (Hash).
    url = "https://api.pinata.cloud/pinning/pinFileToIPFS"
    headers = {
        "Authorization": f"Bearer {PINATA_JWT}"
    }
    try:
        with open(filepath, 'rb') as file:
            # We send the file as multipart/form-data
            response = requests.post(url,files={'file': file}, headers=headers)
            response.raise_for_status() #raise error if upload fails

            return response.json()['IpfsHash']
    except Exception as e:
        print(f'IPFS Upload error: {e}')
        return None
