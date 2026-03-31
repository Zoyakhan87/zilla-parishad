# model.py
import pandas as pd
from sklearn.linear_model import LinearRegression
import pickle

# sample training data
data = pd.DataFrame({
    "month": [1,2,3,4,5],
    "cases": [10,20,30,50,80]
})

X = data[["month"]]
y = data["cases"]

model = LinearRegression()
model.fit(X, y)

# save model
pickle.dump(model, open("model.pkl", "wb"))



# app.py (Python ML API)
from flask import Flask, request, jsonify
import pickle

app = Flask(__name__)

model = pickle.load(open("model.pkl", "rb"))

@app.route("/predict", methods=["POST"])
def predict():
    data = request.json
    month = data["month"]

    prediction = model.predict([[month]])[0]

    return jsonify({
        "prediction": int(prediction),
        "riskLevel": "High" if prediction > 50 else "Low"
    })

if __name__ == "__main__":
    app.run(port=5001)