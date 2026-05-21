// SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

contract Certificates{
    address public admin;

    struct CertificateData{
        string name;
        string course;
        string IPFSCID;
        uint256 date;
        bool isValid;
    }
    mapping(bytes32 => CertificateData) public certificates;

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }

    constructor(){
        admin = msg.sender;
        }

    function issueCertificate(
        string memory _name,
        string memory _course, 
        string memory _IPFSCID, 
        bytes32 _certificateHash)
        public onlyAdmin(){
        require(!certificates[_certificateHash].isValid, "Certificate already exists");

        // Storing the data
        certificates[_certificateHash] = CertificateData(_name,_course, _IPFSCID, block.timestamp, true);
    }
    function verifyCeritificate(bytes32 _certificateHash)public view returns(
        string memory name, 
        string memory course, 
        string memory IPFSCID,
        bool isValid){
        CertificateData storage certdata = certificates[_certificateHash];
        require(certdata.date != 0, "Certificate does not exist");
        return (certdata.name, certdata.course, certdata.IPFSCID, certdata.isValid);
    }
    function revokeCertificate(bytes32 _certificateHash)public  onlyAdmin(){

        require(certificates[_certificateHash].date != 0, "Certificate not found");
        certificates[_certificateHash].isValid = false;
    }
}

