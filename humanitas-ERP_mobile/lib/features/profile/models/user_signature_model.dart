class UserSignatureModel {
  final String? signatureUrl;

  const UserSignatureModel({this.signatureUrl});

  factory UserSignatureModel.fromJson(Map<String, dynamic> json) =>
      UserSignatureModel(signatureUrl: json['signature_url']?.toString());

  Map<String, dynamic> toJson() => {
        'signature_url': signatureUrl,
      };
}
