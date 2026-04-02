from flask import Flask, request, jsonify
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import PolynomialFeatures
from sklearn.pipeline import make_pipeline

app = Flask(__name__)

@app.route("/predict", methods=["POST"])
def predict():
    try:
        req = request.json

        if not req or "data" not in req:
            return jsonify({"error": "No data provided"}), 400

        df = pd.DataFrame(req["data"])

        if df.empty:
            return jsonify({"error": "Empty dataset"}), 400

        # ensure required columns
        if "total" not in df.columns:
            df["total"] = df["sam"] + df["mam"]

        # create time index
        df = df.reset_index(drop=True)
        df["month"] = df.index + 1

        X = df[["month"]]
        y = df["total"]

        # ✅ Improved model (handles curves better)
        model = make_pipeline(
            PolynomialFeatures(degree=2),
            LinearRegression()
        )
        model.fit(X, y)

        # ✅ predict next month
        next_month = [[len(df) + 1]]
        prediction = model.predict(next_month)[0]

        # ✅ prevent negative prediction
        prediction = max(10, prediction)  # minimum threshold

        # previous month prediction
        prev = model.predict([[len(df)]])[0]
        prev = max(1, prev)  # avoid divide by zero

        # ✅ growth calculation (controlled)
        if prev <= 0:
         growth = 0
        else:
         growth = ((prediction - prev) / prev) * 100

        # clamp values
         growth = max(min(growth, 100), -50)

        # limit extreme values
         growth = max(min(growth, 100), -100)

        # ✅ better risk logic
        if prediction > 70:
            risk = "High"
        elif prediction > 30:
            risk = "Medium"
        else:
            risk = "Low"

        return jsonify({
            "prediction": int(prediction),
            "riskLevel": risk,
            "growthRate": round(growth, 2)
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(port=5001, debug=True)




#this is for malaria prediction

# # model.py
# import pandas as pd
# from sklearn.linear_model import LinearRegression
# import pickle

# # sample training data
# data = pd.DataFrame({
#     "month": [1,2,3,4,5],
#     "cases": [10,20,30,50,80]
# })

# X = data[["month"]]
# y = data["cases"]

# model = LinearRegression()
# model.fit(X, y)

# # save model
# pickle.dump(model, open("model.pkl", "wb"))



# # app.py (Python ML API)
# from flask import Flask, request, jsonify
# import pickle

# app = Flask(__name__)

# model = pickle.load(open("model.pkl", "rb"))

# @app.route("/predict", methods=["POST"])
# def predict():
#     data = request.json
#     month = data["month"]

#     prediction = model.predict([[month]])[0]

#     return jsonify({
#         "prediction": int(prediction),
#         "riskLevel": "High" if prediction > 50 else "Low"
#     })

# if __name__ == "__main__":
#     app.run(port=5001)


