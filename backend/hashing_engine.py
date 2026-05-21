import hashlib

def generate_pdf_hash(filename):
    hash_file = hashlib.sha256()
    
    # Opening in binary mode 'rb' is crucial for consistent hashing
    with open(filename, 'rb') as file:
        # Read in 4096-byte chunks for memory efficiency
        while chunk := file.read(4096): 
            hash_file.update(chunk)
            
    # return with () and add '0x' prefix for blockchain compatibility
    return "0x" + hash_file.hexdigest()