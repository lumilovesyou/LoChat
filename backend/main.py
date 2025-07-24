from flask import Flask, request, jsonify, render_template, send_file
from flask_socketio import SocketIO, emit
from flask_cors import CORS
import html
import json
import os

messageCache = []
currentDirectory = __file__.split("main")[0]

if os.path.exists(f"{currentDirectory}/messages.jsonl"):
    with open(f"{currentDirectory}/messages.jsonl", "r") as file:
        database = file.readlines()
        if len(database) > 0:
            for line in database[-30:]:
                messageCache.append(json.loads(line))
else:
    with open(f"{currentDirectory}/messages.jsonl", "w") as file:
        file.close()

app = Flask(__name__, template_folder="../site/", static_folder="../assets/")
socketio = SocketIO(app, cors_allowed_origins="*")
CORS(app)

@app.route("/")
def index():
    return render_template(f"index.html")

@app.route('/emojis')
def get_file():
    return send_file("./emojis.json")

@app.route("/message", methods=["Post"])
def handleMessage():
    data = request.get_json()
    id = data.get("id")
    message = data.get("message")
    messageCache.append(message)
    if len(messageCache) > 21:
        messageCache.pop(0)
    response = {"status": "ok", "verify": id}
    with open(f"{currentDirectory}/messages.jsonl", "a") as file:
        file.write(json.dumps({"username": message}) + "\n")
    return jsonify(response)

@app.route("/ping", methods=["GET"])
def ping():
    return jsonify({"status": "ok", "loads": messageCache}), 200

@app.route("/command", methods=["POST"])
def command():
    command = request.get_json().get("command")
    with open(f"{currentDirectory}/commands.json", "r") as file:
        commands = json.loads(file.read())
    if (command in commands):
        return jsonify({"execute": commands[command]})
    else:
        return jsonify({"execute": ""})

@socketio.on("sendMessage")
def sendMessage(data):
    data["message"] = html.escape(data["message"])
    data["username"] = data["username"].replace("\n", "").replace("\r", "")[:25]
    emit("confirmMessage", {"id": data["verify"]}, broadcast=False)
    data.pop("verify")
    messageCache.append(data)
    if len(messageCache) > 30:
        messageCache.pop(0)
    with open(f"{currentDirectory}/messages.jsonl", "a") as file:
        file.write(json.dumps(data) + "\n")
    emit("readMessage", data, broadcast=True, include_self=False)

if __name__ == '__main__':
    socketio.run(app, host="0.0.0.0", port=5000, debug=True)